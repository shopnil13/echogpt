import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';

import {
  type ChatInput,
  type ProviderRuntimeConfig,
} from '../interfaces/ai-provider-adapter.interface';
import { AiProviderError } from './ai-provider.error';
import { AnthropicAdapter } from './anthropic.adapter';
import { MockAdapter } from './mock.adapter';
import { OpenAiAdapter } from './openai.adapter';

type Handler = (request: IncomingMessage, body: string, response: ServerResponse) => void;

/** Local stand-in for provider APIs so the real SDKs are exercised without network access. */
async function startServer(handler: Handler): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => handler(request, body, response));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

function json(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

const input: ChatInput = {
  model: 'test-model',
  system: 'Be brief.',
  messages: [{ role: 'user', content: 'Hello' }],
  maxOutputTokens: 256,
};

describe('provider adapters', () => {
  let server: Server | undefined;

  afterEach(async () => {
    const running = server;
    server = undefined;
    if (!running) return;
    running.closeAllConnections();
    await new Promise((resolve) => running.close(resolve));
  });

  async function config(handler: Handler): Promise<ProviderRuntimeConfig> {
    const started = await startServer(handler);
    server = started.server;
    return { apiKey: 'test-key', baseUrl: started.baseUrl, timeoutMs: 2000 };
  }

  describe('AnthropicAdapter', () => {
    const adapter = new AnthropicAdapter();

    it('maps text and token usage and sends the system prompt separately', async () => {
      let requestBody: Record<string, unknown> = {};
      const runtime = await config((_request, body, response) => {
        requestBody = JSON.parse(body) as Record<string, unknown>;
        json(response, 200, {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'test-model',
          content: [{ type: 'text', text: 'Hi there' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 12, output_tokens: 3 },
        });
      });

      const result = await adapter.chat(input, runtime);

      expect(result).toEqual({
        text: 'Hi there',
        model: 'test-model',
        usage: { promptTokens: 12, completionTokens: 3 },
      });
      expect(requestBody).toMatchObject({ system: 'Be brief.', max_tokens: 256 });
      // Server-side fallbacks are only sent to the first-party API.
      expect(requestBody).not.toHaveProperty('fallbacks');
    });

    it('turns a refusal stop reason into PROVIDER_REFUSED', async () => {
      const runtime = await config((_request, _body, response) =>
        json(response, 200, {
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          model: 'test-model',
          content: [],
          stop_reason: 'refusal',
          stop_details: { type: 'refusal', category: 'cyber', explanation: null },
          usage: { input_tokens: 5, output_tokens: 0 },
        }),
      );

      await expect(adapter.chat(input, runtime)).rejects.toMatchObject({
        code: 'PROVIDER_REFUSED',
        status: 422,
      });
    });

    it.each([
      [401, 'PROVIDER_AUTH_FAILED'],
      [429, 'PROVIDER_RATE_LIMITED'],
      [500, 'PROVIDER_UNAVAILABLE'],
    ])('normalizes HTTP %i to %s', async (status, code) => {
      const runtime = await config((_request, _body, response) =>
        json(response, status, {
          type: 'error',
          error: { type: 'api_error', message: 'upstream said no' },
        }),
      );

      const error = await adapter.chat(input, runtime).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).code).toBe(code);
      expect((error as AiProviderError).message).not.toContain('upstream said no');
    });
  });

  describe('OpenAiAdapter', () => {
    const adapter = new OpenAiAdapter();

    it('prepends the system prompt and maps usage', async () => {
      let requestBody: { messages?: Array<{ role: string }> } = {};
      const runtime = await config((_request, body, response) => {
        requestBody = JSON.parse(body) as typeof requestBody;
        json(response, 200, {
          id: 'cmpl_1',
          object: 'chat.completion',
          created: 0,
          model: 'test-model',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: { role: 'assistant', content: 'Hello!', refusal: null },
            },
          ],
          usage: { prompt_tokens: 9, completion_tokens: 2, total_tokens: 11 },
        });
      });

      const result = await adapter.chat(input, runtime);

      expect(result).toEqual({
        text: 'Hello!',
        model: 'test-model',
        usage: { promptTokens: 9, completionTokens: 2 },
      });
      expect(requestBody.messages?.map((message) => message.role)).toEqual(['system', 'user']);
    });

    it('normalizes auth failures', async () => {
      const runtime = await config((_request, _body, response) =>
        json(response, 401, { error: { message: 'bad key', type: 'invalid_request_error' } }),
      );
      await expect(adapter.chat(input, runtime)).rejects.toMatchObject({
        code: 'PROVIDER_AUTH_FAILED',
      });
    });
  });

  describe('MockAdapter', () => {
    const adapter = new MockAdapter();
    const runtime: ProviderRuntimeConfig = { apiKey: null, baseUrl: null, timeoutMs: 1000 };

    it('streams the same text it returns', async () => {
      const deltas: string[] = [];
      let completed = '';
      for await (const event of adapter.chatStream(input, runtime)) {
        if (event.type === 'delta') deltas.push(event.text);
        else completed = event.result.text;
      }
      expect(deltas.join('')).toBe(completed);
      expect(completed).toContain('Hello');
    });

    it('supports failure markers', async () => {
      await expect(
        adapter.chat({ ...input, messages: [{ role: 'user', content: 'x [mock:fail]' }] }),
      ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
      await expect(
        adapter.chat({ ...input, messages: [{ role: 'user', content: 'x [mock:refuse]' }] }),
      ).rejects.toMatchObject({ code: 'PROVIDER_REFUSED' });
    });
  });
});

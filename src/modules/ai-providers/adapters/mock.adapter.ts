import { setTimeout as sleep } from 'node:timers/promises';

import { Injectable } from '@nestjs/common';

import { ProviderType } from '../../../generated/prisma/enums';
import {
  type AiProviderAdapter,
  type ChatInput,
  type ChatResult,
  type ChatStreamEvent,
  type ProviderRuntimeConfig,
} from '../interfaces/ai-provider-adapter.interface';
import { AiProviderError } from './ai-provider.error';

/** Magic markers let tests and reviewers exercise failure paths without a real provider. */
export const MOCK_FAIL_MARKER = '[mock:fail]';
export const MOCK_REFUSE_MARKER = '[mock:refuse]';
const STREAM_DELAY_MS = 5;
const ECHO_PREVIEW_LENGTH = 200;

/**
 * Deterministic, keyless provider for development, automated tests and reviewers. Enabled only
 * when AI_MOCK_PROVIDER_ENABLED=true.
 */
@Injectable()
export class MockAdapter implements AiProviderAdapter {
  readonly type = ProviderType.MOCK;

  chat(input: ChatInput): Promise<ChatResult> {
    // The executor turns a thrown failure into a rejection, matching real adapters.
    return new Promise((resolve) => resolve(this.respond(input)));
  }

  async *chatStream(
    input: ChatInput,
    _config: ProviderRuntimeConfig,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    const result = this.respond(input);
    for (const word of result.text.split(/(?<= )/)) {
      if (signal?.aborted) throw new AiProviderError('ABORTED', 'Request aborted by the caller');
      await sleep(STREAM_DELAY_MS);
      yield { type: 'delta', text: word };
    }
    yield { type: 'complete', result };
  }

  healthCheck(): Promise<void> {
    return Promise.resolve();
  }

  private respond(input: ChatInput): ChatResult {
    const lastUser =
      [...input.messages].reverse().find((turn) => turn.role === 'user')?.content ?? '';
    if (lastUser.includes(MOCK_FAIL_MARKER))
      throw new AiProviderError('UNAVAILABLE', 'Mock failure requested');
    if (lastUser.includes(MOCK_REFUSE_MARKER))
      throw new AiProviderError('REFUSED', 'Mock refusal requested');

    const preview =
      lastUser.length > ECHO_PREVIEW_LENGTH
        ? `${lastUser.slice(0, ECHO_PREVIEW_LENGTH)}…`
        : lastUser;
    const text = `Mock reply (${input.model}, ${input.messages.length} message(s) in context): ${preview}`;
    return {
      text,
      model: input.model,
      usage: { promptTokens: countWords(input), completionTokens: text.split(/\s+/).length },
    };
  }
}

function countWords(input: ChatInput): number {
  const all = [input.system ?? '', ...input.messages.map((turn) => turn.content)].join(' ');
  return all.split(/\s+/).filter(Boolean).length;
}

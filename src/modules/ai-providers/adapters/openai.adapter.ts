import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

import { ProviderType } from '../../../generated/prisma/enums';
import {
  type AiProviderAdapter,
  type ChatInput,
  type ChatResult,
  type ChatStreamEvent,
  type ProviderRuntimeConfig,
} from '../interfaces/ai-provider-adapter.interface';
import { AiProviderError, classifyHttpStatus } from './ai-provider.error';

const SDK_MAX_RETRIES = 1;

@Injectable()
export class OpenAiAdapter implements AiProviderAdapter {
  readonly type = ProviderType.OPENAI;

  async chat(
    input: ChatInput,
    config: ProviderRuntimeConfig,
    signal?: AbortSignal,
  ): Promise<ChatResult> {
    try {
      const completion = await this.client(config).chat.completions.create(
        {
          model: input.model,
          messages: this.messages(input),
          max_completion_tokens: input.maxOutputTokens,
        },
        { signal },
      );
      const choice = completion.choices[0];
      if (!choice) throw new AiProviderError('UNAVAILABLE', 'OpenAI returned no choices');
      if (choice.finish_reason === 'content_filter' || choice.message.refusal) {
        throw new AiProviderError('REFUSED', choice.message.refusal ?? 'content_filter');
      }
      return {
        text: choice.message.content ?? '',
        model: completion.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens ?? null,
          completionTokens: completion.usage?.completion_tokens ?? null,
        },
      };
    } catch (error: unknown) {
      throw this.normalize(error, signal);
    }
  }

  async *chatStream(
    input: ChatInput,
    config: ProviderRuntimeConfig,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    try {
      const stream = await this.client(config).chat.completions.create(
        {
          model: input.model,
          messages: this.messages(input),
          max_completion_tokens: input.maxOutputTokens,
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal },
      );

      let text = '';
      let model = input.model;
      let usage: ChatResult['usage'] = { promptTokens: null, completionTokens: null };
      for await (const chunk of stream) {
        model = chunk.model || model;
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
          };
        }
        const choice = chunk.choices[0];
        if (choice?.finish_reason === 'content_filter')
          throw new AiProviderError('REFUSED', 'content_filter');
        const delta = choice?.delta.content;
        if (delta) {
          text += delta;
          yield { type: 'delta', text: delta };
        }
      }
      yield { type: 'complete', result: { text, model, usage } };
    } catch (error: unknown) {
      throw this.normalize(error, signal);
    }
  }

  async healthCheck(config: ProviderRuntimeConfig, model: string): Promise<void> {
    try {
      await this.client(config).models.retrieve(model);
    } catch (error: unknown) {
      throw this.normalize(error);
    }
  }

  private client(config: ProviderRuntimeConfig): OpenAI {
    return new OpenAI({
      apiKey: config.apiKey ?? undefined,
      baseURL: config.baseUrl ?? undefined,
      timeout: config.timeoutMs,
      maxRetries: SDK_MAX_RETRIES,
    });
  }

  private messages(input: ChatInput): OpenAI.Chat.ChatCompletionMessageParam[] {
    const history = input.messages.map((turn): OpenAI.Chat.ChatCompletionMessageParam => ({
      role: turn.role,
      content: turn.content,
    }));
    return input.system ? [{ role: 'system', content: input.system }, ...history] : history;
  }

  private normalize(error: unknown, signal?: AbortSignal): AiProviderError {
    if (error instanceof AiProviderError) return error;
    if (error instanceof OpenAI.APIUserAbortError || signal?.aborted) {
      return new AiProviderError('ABORTED', 'Request aborted by the caller', error);
    }
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return new AiProviderError('TIMEOUT', 'OpenAI request timed out', error);
    }
    if (error instanceof OpenAI.APIConnectionError) {
      return new AiProviderError('UNAVAILABLE', `OpenAI connection error: ${error.message}`, error);
    }
    if (error instanceof OpenAI.APIError) {
      // The SDK's generic status parameter widens to `any` after narrowing; pin it.
      const status = (error as { status?: number }).status;
      return new AiProviderError(
        classifyHttpStatus(status),
        `OpenAI ${status}: ${error.message}`,
        error,
      );
    }
    return new AiProviderError(
      'UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown OpenAI error',
      error,
    );
  }
}

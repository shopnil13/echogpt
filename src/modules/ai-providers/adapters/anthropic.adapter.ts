import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';

import { ProviderType } from '../../../generated/prisma/enums';
import {
  type AiProviderAdapter,
  type ChatInput,
  type ChatResult,
  type ChatStreamEvent,
  type ProviderRuntimeConfig,
} from '../interfaces/ai-provider-adapter.interface';
import { AiProviderError, classifyHttpStatus } from './ai-provider.error';

/**
 * Models that support server-side refusal fallbacks. For these, a safety-classifier decline is
 * retried by the API on Anthropic's recommended model for that refusal category instead of
 * failing the user's request.
 */
const FALLBACK_CAPABLE_MODELS = new Set(['claude-opus-5', 'claude-fable-5-1']);
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const SDK_MAX_RETRIES = 1;

type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;

@Injectable()
export class AnthropicAdapter implements AiProviderAdapter {
  readonly type = ProviderType.ANTHROPIC;

  async chat(
    input: ChatInput,
    config: ProviderRuntimeConfig,
    signal?: AbortSignal,
  ): Promise<ChatResult> {
    try {
      const message = await this.client(config).beta.messages.create(this.params(input, config), {
        signal,
      });
      return this.toResult(message);
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
      const stream = this.client(config).beta.messages.stream(this.params(input, config), {
        signal,
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'delta', text: event.delta.text };
        }
      }
      // A mid-stream refusal surfaces here; the caller discards the partial text.
      yield { type: 'complete', result: this.toResult(await stream.finalMessage()) };
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

  private client(config: ProviderRuntimeConfig): Anthropic {
    return new Anthropic({
      apiKey: config.apiKey ?? undefined,
      baseURL: config.baseUrl ?? undefined,
      timeout: config.timeoutMs,
      maxRetries: SDK_MAX_RETRIES,
    });
  }

  private params(input: ChatInput, config: ProviderRuntimeConfig): CreateParams {
    // Server-side fallbacks exist only on the first-party API, not behind a custom base URL.
    const useFallbacks = FALLBACK_CAPABLE_MODELS.has(input.model) && !config.baseUrl;
    return {
      model: input.model,
      max_tokens: input.maxOutputTokens,
      ...(input.system ? { system: input.system } : {}),
      messages: input.messages.map((turn) => ({ role: turn.role, content: turn.content })),
      ...(useFallbacks ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
    };
  }

  private toResult(message: Anthropic.Beta.BetaMessage): ChatResult {
    if (message.stop_reason === 'refusal') {
      throw new AiProviderError(
        'REFUSED',
        `Refusal (category: ${message.stop_details?.category ?? 'unknown'})`,
      );
    }
    const text = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return {
      text,
      model: message.model,
      usage: {
        promptTokens: message.usage.input_tokens,
        completionTokens: message.usage.output_tokens,
      },
    };
  }

  /** Most specific first: in this SDK the abort and connection errors extend APIError. */
  private normalize(error: unknown, signal?: AbortSignal): AiProviderError {
    if (error instanceof AiProviderError) return error;
    if (error instanceof Anthropic.APIUserAbortError || signal?.aborted) {
      return new AiProviderError('ABORTED', 'Request aborted by the caller', error);
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return new AiProviderError('TIMEOUT', 'Anthropic request timed out', error);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return new AiProviderError(
        'UNAVAILABLE',
        `Anthropic connection error: ${error.message}`,
        error,
      );
    }
    if (error instanceof Anthropic.APIError) {
      // The SDK's generic status parameter widens to `any` after narrowing; pin it.
      const status = (error as { status?: number }).status;
      return new AiProviderError(
        classifyHttpStatus(status),
        `Anthropic ${status}: ${error.message}`,
        error,
      );
    }
    return new AiProviderError(
      'UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown Anthropic error',
      error,
    );
  }
}

import { type Content, type GenerateContentResponse, GoogleGenAI, ApiError } from '@google/genai';
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

const BLOCKED_FINISH_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII']);

@Injectable()
export class GeminiAdapter implements AiProviderAdapter {
  readonly type = ProviderType.GEMINI;

  async chat(
    input: ChatInput,
    config: ProviderRuntimeConfig,
    signal?: AbortSignal,
  ): Promise<ChatResult> {
    try {
      const response = await this.client(config).models.generateContent(
        this.request(input, signal),
      );
      this.assertNotBlocked(response);
      return {
        text: response.text ?? '',
        model: response.modelVersion ?? input.model,
        usage: this.usage(response),
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
      const stream = await this.client(config).models.generateContentStream(
        this.request(input, signal),
      );
      let text = '';
      let last: GenerateContentResponse | undefined;
      for await (const chunk of stream) {
        this.assertNotBlocked(chunk);
        last = chunk;
        const delta = chunk.text;
        if (delta) {
          text += delta;
          yield { type: 'delta', text: delta };
        }
      }
      yield {
        type: 'complete',
        result: {
          text,
          model: last?.modelVersion ?? input.model,
          usage: last ? this.usage(last) : { promptTokens: null, completionTokens: null },
        },
      };
    } catch (error: unknown) {
      throw this.normalize(error, signal);
    }
  }

  async healthCheck(config: ProviderRuntimeConfig, model: string): Promise<void> {
    try {
      await this.client(config).models.get({ model });
    } catch (error: unknown) {
      throw this.normalize(error);
    }
  }

  private client(config: ProviderRuntimeConfig): GoogleGenAI {
    return new GoogleGenAI({
      apiKey: config.apiKey ?? undefined,
      httpOptions: {
        timeout: config.timeoutMs,
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
      },
    });
  }

  private request(
    input: ChatInput,
    signal?: AbortSignal,
  ): Parameters<GoogleGenAI['models']['generateContent']>[0] {
    const contents: Content[] = input.messages.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    }));
    return {
      model: input.model,
      contents,
      config: {
        maxOutputTokens: input.maxOutputTokens,
        ...(input.system ? { systemInstruction: input.system } : {}),
        ...(signal ? { abortSignal: signal } : {}),
      },
    };
  }

  private assertNotBlocked(response: GenerateContentResponse): void {
    const blockReason = response.promptFeedback?.blockReason;
    const finishReason = response.candidates?.[0]?.finishReason;
    if (blockReason || (finishReason && BLOCKED_FINISH_REASONS.has(finishReason))) {
      throw new AiProviderError('REFUSED', `Blocked: ${blockReason ?? finishReason}`);
    }
  }

  private usage(response: GenerateContentResponse): ChatResult['usage'] {
    return {
      promptTokens: response.usageMetadata?.promptTokenCount ?? null,
      completionTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    };
  }

  private normalize(error: unknown, signal?: AbortSignal): AiProviderError {
    if (error instanceof AiProviderError) return error;
    if (signal?.aborted)
      return new AiProviderError('ABORTED', 'Request aborted by the caller', error);
    if (error instanceof ApiError) {
      return new AiProviderError(
        classifyHttpStatus(error.status),
        `Gemini ${error.status}: ${error.message}`,
        error,
      );
    }
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      return new AiProviderError('TIMEOUT', 'Gemini request timed out', error);
    }
    return new AiProviderError(
      'UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown Gemini error',
      error,
    );
  }
}

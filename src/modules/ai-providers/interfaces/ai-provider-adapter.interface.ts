import { type ProviderType } from '../../../generated/prisma/enums';

/** Provider-neutral chat turn. System instructions travel separately in `ChatInput.system`. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatInput {
  model: string;
  system?: string;
  messages: ChatTurn[];
  maxOutputTokens: number;
}

export interface TokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface ChatResult {
  text: string;
  /** Model that actually answered (may differ from the requested one, e.g. after a server-side fallback). */
  model: string;
  usage: TokenUsage;
}

export type ChatStreamEvent =
  { type: 'delta'; text: string } | { type: 'complete'; result: ChatResult };

/** Decrypted, per-call configuration. Lives only in memory for the duration of the call. */
export interface ProviderRuntimeConfig {
  apiKey: string | null;
  baseUrl: string | null;
  timeoutMs: number;
}

/**
 * Strategy contract every AI provider implements (ADR-010). Adapters translate the neutral
 * input to their SDK, enforce the timeout, and throw `AiProviderError` for every failure.
 */
export interface AiProviderAdapter {
  readonly type: ProviderType;
  chat(input: ChatInput, config: ProviderRuntimeConfig, signal?: AbortSignal): Promise<ChatResult>;
  chatStream(
    input: ChatInput,
    config: ProviderRuntimeConfig,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent>;
  /** Cheap authenticated call (no token spend) proving the key and model are usable. */
  healthCheck(config: ProviderRuntimeConfig, model: string): Promise<void>;
}

export const AI_PROVIDER_ADAPTERS = Symbol('AI_PROVIDER_ADAPTERS');

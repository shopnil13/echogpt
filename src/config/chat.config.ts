import { registerAs } from '@nestjs/config';

import { envInt, envString } from './env.utils';

export const chatConfig = registerAs('chat', () => ({
  contextMessages: envInt('CHAT_CONTEXT_MESSAGES'),
  systemPrompt: envString('CHAT_SYSTEM_PROMPT'),
  streamHeartbeatMs: envInt('CHAT_STREAM_HEARTBEAT_MS'),
}));

export type ChatConfig = ReturnType<typeof chatConfig>;

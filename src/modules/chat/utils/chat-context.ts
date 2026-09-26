import { type Message } from '../../../generated/prisma/client';
import { MessageRole } from '../../../generated/prisma/enums';
import { type ChatTurn } from '../../ai-providers/interfaces/ai-provider-adapter.interface';

export const DEFAULT_CONVERSATION_TITLE = 'New conversation';
const TITLE_MAX_LENGTH = 60;

/** Converts stored messages to provider turns. Providers require the first turn to be the user's. */
export function toChatTurns(messages: Message[]): ChatTurn[] {
  const turns = messages
    .filter((message) => message.role !== MessageRole.SYSTEM)
    .map((message): ChatTurn => ({
      role: message.role === MessageRole.USER ? 'user' : 'assistant',
      content: message.content,
    }));
  const firstUser = turns.findIndex((turn) => turn.role === 'user');
  return firstUser === -1 ? [] : turns.slice(firstUser);
}

/** First line of the first prompt, trimmed to a readable title. */
export function titleFromPrompt(prompt: string): string {
  const firstLine = prompt.trim().split('\n')[0]?.trim() ?? '';
  if (!firstLine) return DEFAULT_CONVERSATION_TITLE;
  return firstLine.length > TITLE_MAX_LENGTH
    ? `${firstLine.slice(0, TITLE_MAX_LENGTH - 1)}…`
    : firstLine;
}

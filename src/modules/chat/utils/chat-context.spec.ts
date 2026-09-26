import { type Message } from '../../../generated/prisma/client';
import { DEFAULT_CONVERSATION_TITLE, titleFromPrompt, toChatTurns } from './chat-context';

function message(role: Message['role'], content: string): Message {
  return { role, content } as Message;
}

describe('chat context', () => {
  it('drops system messages and leading assistant turns', () => {
    const turns = toChatTurns([
      message('ASSISTANT', 'orphan'),
      message('SYSTEM', 'ignored'),
      message('USER', 'hi'),
      message('ASSISTANT', 'hello'),
    ]);
    expect(turns).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
  });

  it('builds titles from the first line of the prompt', () => {
    expect(titleFromPrompt('  Plan a trip\nwith details')).toBe('Plan a trip');
    expect(titleFromPrompt('x'.repeat(100))).toHaveLength(60);
    expect(titleFromPrompt('   ')).toBe(DEFAULT_CONVERSATION_TITLE);
  });
});

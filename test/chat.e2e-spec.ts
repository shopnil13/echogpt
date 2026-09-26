import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { bearer, registerUser, type TestSession } from './utils/auth.helpers';
import { createTestApp } from './utils/create-test-app';

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

function parseSse(body: string): SseEvent[] {
  return body
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.startsWith('event:'))
    .map((block) => {
      const [eventLine = '', dataLine = ''] = block.split('\n');
      return {
        event: eventLine.replace('event: ', ''),
        data: JSON.parse(dataLine.replace('data: ', '')) as Record<string, unknown>,
      };
    });
}

describe('Chat (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let user: TestSession;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    user = await registerUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function newConversation(
    session = user,
    body: Record<string, unknown> = {},
  ): Promise<string> {
    const response = await http()
      .post('/api/v1/chat/conversations')
      .set(bearer(session.accessToken))
      .send(body)
      .expect(201);
    return response.body.id as string;
  }

  async function usedQuota(session = user): Promise<number> {
    const response = await http()
      .get('/api/v1/subscriptions/me/usage')
      .set(bearer(session.accessToken))
      .expect(200);
    return response.body.used as number;
  }

  it('sends a prompt, stores both messages and titles the conversation', async () => {
    const id = await newConversation();
    const before = await usedQuota();

    const response = await http()
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .set(bearer(user.accessToken))
      .send({ content: 'Plan a weekend in Lisbon' })
      .expect(201);

    expect(response.body.userMessage).toMatchObject({
      role: 'USER',
      content: 'Plan a weekend in Lisbon',
    });
    expect(response.body.assistantMessage).toMatchObject({
      role: 'ASSISTANT',
      status: 'COMPLETED',
      model: 'mock-echo',
    });
    expect(response.body.assistantMessage.content).toContain('Plan a weekend in Lisbon');
    expect(response.headers['x-quota-remaining']).toBeDefined();
    expect(await usedQuota()).toBe(before + 1);

    const conversation = await http()
      .get(`/api/v1/chat/conversations/${id}`)
      .set(bearer(user.accessToken))
      .expect(200);
    expect(conversation.body).toMatchObject({
      title: 'Plan a weekend in Lisbon',
      model: 'mock-echo',
    });
  });

  it('sends earlier messages as context and returns history oldest first', async () => {
    const id = await newConversation();
    const send = (content: string) =>
      http()
        .post(`/api/v1/chat/conversations/${id}/messages`)
        .set(bearer(user.accessToken))
        .send({ content })
        .expect(201);

    await send('first');
    const second = await send('second');
    // Mock reply reports how many messages it received: user, assistant, user.
    expect(second.body.assistantMessage.content).toContain('3 message(s) in context');

    const history = await http()
      .get(`/api/v1/chat/conversations/${id}/messages?limit=10`)
      .set(bearer(user.accessToken))
      .expect(200);
    expect(history.body.meta.total).toBe(4);
    expect(history.body.data.map((message: { role: string }) => message.role)).toEqual([
      'USER',
      'ASSISTANT',
      'USER',
      'ASSISTANT',
    ]);
  });

  it("hides other users' conversations", async () => {
    const id = await newConversation();
    const intruder = await registerUser(app);

    const attempts = [
      () => http().get(`/api/v1/chat/conversations/${id}`),
      () => http().get(`/api/v1/chat/conversations/${id}/messages`),
      () => http().patch(`/api/v1/chat/conversations/${id}`).send({ title: 'mine now' }),
      () => http().delete(`/api/v1/chat/conversations/${id}`),
      () => http().post(`/api/v1/chat/conversations/${id}/messages`).send({ content: 'hi' }),
    ];
    for (const attempt of attempts) {
      const response = await attempt().set(bearer(intruder.accessToken)).expect(404);
      expect(response.body.code).toBe('CONVERSATION_NOT_FOUND');
    }
    // The failed attempt must not cost the intruder any quota.
    expect(await usedQuota(intruder)).toBe(0);
  });

  it('refunds quota and records a FAILED message when the provider fails', async () => {
    const id = await newConversation();
    const before = await usedQuota();

    const response = await http()
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .set(bearer(user.accessToken))
      .send({ content: 'please [mock:fail]' })
      .expect(502);

    expect(response.body.code).toBe('PROVIDER_UNAVAILABLE');
    expect(await usedQuota()).toBe(before);
    const failed = await prisma.message.findFirst({
      where: { conversationId: id, status: 'FAILED' },
    });
    expect(failed?.errorCode).toBe('PROVIDER_UNAVAILABLE');
  });

  it('rejects unknown providers and models before calling anything', async () => {
    const id = await newConversation();
    const badModel = await http()
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .set(bearer(user.accessToken))
      .send({ content: 'hi', model: 'does-not-exist' })
      .expect(422);
    expect(badModel.body.code).toBe('PROVIDER_MODEL_NOT_ALLOWED');

    const disabled = await prisma.aiProvider.findFirstOrThrow({ where: { isEnabled: false } });
    const response = await http()
      .post('/api/v1/chat/conversations')
      .set(bearer(user.accessToken))
      .send({ providerId: disabled.id })
      .expect(422);
    expect(response.body.code).toBe('PROVIDER_DISABLED');
  });

  it('lists, searches, renames and deletes conversations', async () => {
    const session = await registerUser(app);
    const keep = await newConversation(session, { title: 'Recipes for dinner' });
    await newConversation(session, { title: 'Work notes' });

    const search = await http()
      .get('/api/v1/chat/conversations?search=RECIPE')
      .set(bearer(session.accessToken))
      .expect(200);
    expect(search.body.data.map((conversation: { id: string }) => conversation.id)).toEqual([keep]);

    await http()
      .patch(`/api/v1/chat/conversations/${keep}`)
      .set(bearer(session.accessToken))
      .send({ title: 'Dinner ideas' })
      .expect(200);
    await http()
      .delete(`/api/v1/chat/conversations/${keep}`)
      .set(bearer(session.accessToken))
      .expect(204);

    const list = await http()
      .get('/api/v1/chat/conversations')
      .set(bearer(session.accessToken))
      .expect(200);
    expect(list.body.meta.total).toBe(1);
  });

  describe('streaming', () => {
    it('streams deltas and persists the final message', async () => {
      const id = await newConversation();

      const response = await http()
        .post(`/api/v1/chat/conversations/${id}/messages/stream`)
        .set(bearer(user.accessToken))
        .send({ content: 'Stream this please' })
        .expect(200)
        .expect('content-type', /text\/event-stream/);

      const events = parseSse(response.text);
      expect(events[0]?.event).toBe('message.start');
      expect(events.at(-1)?.event).toBe('message.complete');

      const streamed = events
        .filter((event) => event.event === 'message.delta')
        .map((event) => event.data.text)
        .join('');
      const stored = await prisma.message.findUniqueOrThrow({
        where: { id: events.at(-1)?.data.assistantMessageId as string },
      });
      expect(stored.content).toBe(streamed);
    });

    it('returns JSON errors before streaming starts', async () => {
      const response = await http()
        .post('/api/v1/chat/conversations/0192f0c4-8a3e-7c1e-9d2b-5b1f3a9c2e10/messages/stream')
        .set(bearer(user.accessToken))
        .send({ content: 'hi' })
        .expect(404);
      expect(response.body.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('emits an error event and refunds quota when the provider fails mid-stream', async () => {
      const id = await newConversation();
      const before = await usedQuota();

      const response = await http()
        .post(`/api/v1/chat/conversations/${id}/messages/stream`)
        .set(bearer(user.accessToken))
        .send({ content: '[mock:refuse] do something' })
        .expect(200);

      const events = parseSse(response.text);
      expect(events.at(-1)).toMatchObject({ event: 'error', data: { code: 'PROVIDER_REFUSED' } });
      expect(await usedQuota()).toBe(before);
    });
  });

  it('records chat metadata in the usage log', async () => {
    const id = await newConversation();
    const requestId = `chat-usage-${Date.now()}`;
    await http()
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .set(bearer(user.accessToken))
      .set('x-request-id', requestId)
      .send({ content: 'count my tokens' })
      .expect(201);

    let log = null;
    for (let attempt = 0; attempt < 20 && !log; attempt++) {
      log = await prisma.apiUsageLog.findFirst({ where: { requestId } });
      if (!log) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(log).toMatchObject({
      feature: 'CHAT',
      model: 'mock-echo',
      route: '/api/v1/chat/conversations/:id/messages',
    });
    expect(log?.promptTokens).toBeGreaterThan(0);
    expect(log?.completionTokens).toBeGreaterThan(0);
  });
});

import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { bearer, registerUser, type TestSession } from './utils/auth.helpers';
import { createTestApp } from './utils/create-test-app';

describe('Web search (e2e)', () => {
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
  const search = (session: TestSession, body: Record<string, unknown>) =>
    http().post('/api/v1/search').set(bearer(session.accessToken)).send(body);

  it('returns results, then serves the same normalized query from cache', async () => {
    const topic = `cache topic ${randomUUID()}`;

    const first = await search(user, { query: topic, maxResults: 3 }).expect(200);
    expect(first.body).toMatchObject({
      query: topic,
      engine: 'mock',
      fromCache: false,
      summary: null,
    });
    expect(first.body.results).toHaveLength(3);
    expect(first.body.results[0].url).toMatch(/^https:\/\//);

    const second = await search(user, {
      query: `  ${topic.toUpperCase()}  `,
      maxResults: 3,
    }).expect(200);
    expect(second.body.fromCache).toBe(true);
    expect(second.body.results).toEqual(first.body.results);

    const entry = await prisma.searchCacheEntry.findFirstOrThrow({
      where: { normalizedQuery: topic },
    });
    expect(entry.hitCount).toBe(1);
  });

  it('summarizes results with the default AI provider when asked', async () => {
    const response = await search(user, {
      query: 'summarize lisbon cafes',
      summarize: true,
    }).expect(200);
    expect(response.body.summary).toContain('Mock reply');
    expect(response.body.summaryError).toBeNull();
  });

  it('records history per user and returns snapshots', async () => {
    const session = await registerUser(app);
    const created = await search(session, { query: 'history one' }).expect(200);
    await search(session, { query: 'history two' }).expect(200);

    const history = await http()
      .get('/api/v1/search/history')
      .set(bearer(session.accessToken))
      .expect(200);
    expect(history.body.meta.total).toBe(2);
    expect(history.body.data[0]).toMatchObject({
      query: 'history two',
      resultCount: 5,
      hasSummary: false,
    });

    const detail = await http()
      .get(`/api/v1/search/history/${created.body.id}`)
      .set(bearer(session.accessToken))
      .expect(200);
    expect(detail.body.results).toHaveLength(5);

    const other = await registerUser(app);
    const hidden = await http()
      .get(`/api/v1/search/history/${created.body.id}`)
      .set(bearer(other.accessToken))
      .expect(404);
    expect(hidden.body.code).toBe('SEARCH_ENTRY_NOT_FOUND');

    await http()
      .delete(`/api/v1/search/history/${created.body.id}`)
      .set(bearer(session.accessToken))
      .expect(204);
    await http().delete('/api/v1/search/history').set(bearer(session.accessToken)).expect(204);
    const empty = await http()
      .get('/api/v1/search/history')
      .set(bearer(session.accessToken))
      .expect(200);
    expect(empty.body.meta.total).toBe(0);
  });

  it('lists recent distinct queries newest first', async () => {
    const session = await registerUser(app);
    await search(session, { query: 'alpha' }).expect(200);
    await search(session, { query: 'beta' }).expect(200);
    await search(session, { query: 'ALPHA' }).expect(200);

    const recent = await http()
      .get('/api/v1/search/recent?limit=5')
      .set(bearer(session.accessToken))
      .expect(200);
    expect(recent.body.map((entry: { query: string }) => entry.query)).toEqual(['ALPHA', 'beta']);
  });

  it("suggests own history, and other users' queries only when enough users searched them", async () => {
    const prefix = `zq${randomUUID().slice(0, 6)}`;
    const shared = `${prefix} shared topic`;
    const secret = `${prefix} my private medical question`;
    const others = await Promise.all([registerUser(app), registerUser(app), registerUser(app)]);

    for (const session of others) await search(session, { query: shared }).expect(200);
    await search(others[0], { query: secret }).expect(200);

    const session = await registerUser(app);
    await search(session, { query: `${prefix} my own` }).expect(200);

    const response = await http()
      .get(`/api/v1/search/suggestions?q=${encodeURIComponent(prefix.toUpperCase())}`)
      .set(bearer(session.accessToken))
      .expect(200);

    expect(response.body).toEqual([
      { query: `${prefix} my own`, source: 'history' },
      { query: shared, source: 'popular' },
    ]);
  });

  it('treats LIKE wildcards in the prefix literally', async () => {
    const response = await http()
      .get('/api/v1/search/suggestions?q=%25')
      .set(bearer(user.accessToken))
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it('consumes quota per search and validates input', async () => {
    const session = await registerUser(app);
    await search(session, { query: 'quota check' }).expect(200);
    const usage = await http()
      .get('/api/v1/subscriptions/me/usage')
      .set(bearer(session.accessToken))
      .expect(200);
    expect(usage.body.used).toBe(1);

    const invalid = await search(session, { query: '', maxResults: 50 }).expect(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
  });

  it('cleanup job removes expired cache entries only', async () => {
    const topic = `expiring ${randomUUID()}`;
    await search(user, { query: topic }).expect(200);
    await prisma.searchCacheEntry.updateMany({
      where: { normalizedQuery: topic },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await app.get(MaintenanceService).cleanup();

    expect(await prisma.searchCacheEntry.count({ where: { normalizedQuery: topic } })).toBe(0);
    expect(
      await prisma.searchCacheEntry.count({ where: { expiresAt: { gt: new Date() } } }),
    ).toBeGreaterThan(0);
  });
});

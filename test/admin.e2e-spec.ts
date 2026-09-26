import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { bearer, loginAdmin, registerUser, type TestSession } from './utils/auth.helpers';
import { createTestApp } from './utils/create-test-app';

const SAMPLE_ID = '0192f0c4-8a3e-7c1e-9d2b-5b1f3a9c2e10';

/** Every admin route. Add new admin routes here so the RBAC sweep covers them. */
const ADMIN_ROUTES: Array<[method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string]> = [
  ['get', '/api/v1/admin/dashboard/stats'],
  ['get', '/api/v1/admin/system/health'],
  ['get', '/api/v1/admin/users'],
  ['get', `/api/v1/admin/users/${SAMPLE_ID}`],
  ['patch', `/api/v1/admin/users/${SAMPLE_ID}`],
  ['delete', `/api/v1/admin/users/${SAMPLE_ID}`],
  ['put', `/api/v1/admin/users/${SAMPLE_ID}/subscription`],
  ['get', '/api/v1/admin/subscriptions'],
  ['get', '/api/v1/admin/plans'],
  ['patch', `/api/v1/admin/plans/${SAMPLE_ID}`],
  ['get', '/api/v1/admin/providers'],
  ['post', '/api/v1/admin/providers'],
  ['get', `/api/v1/admin/providers/${SAMPLE_ID}`],
  ['patch', `/api/v1/admin/providers/${SAMPLE_ID}`],
  ['delete', `/api/v1/admin/providers/${SAMPLE_ID}`],
  ['patch', `/api/v1/admin/providers/${SAMPLE_ID}/status`],
  ['put', `/api/v1/admin/providers/${SAMPLE_ID}/default`],
  ['post', `/api/v1/admin/providers/${SAMPLE_ID}/health-check`],
  ['get', '/api/v1/admin/analytics/usage'],
  ['get', '/api/v1/admin/logs/requests'],
];

describe('Admin panel (e2e)', () => {
  let app: NestExpressApplication;
  let admin: TestSession;

  beforeAll(async () => {
    app = await createTestApp();
    admin = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const asAdmin = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string) =>
    http()[method](path).set(bearer(admin.accessToken));

  it('rejects normal users (403) and anonymous callers (401) on every admin route', async () => {
    const user = await registerUser(app);
    for (const [method, path] of ADMIN_ROUTES) {
      await http()[method](path).expect(401);
      const response = await http()
        [method](path)
        .set(bearer(user.accessToken))
        .send({})
        .expect(403);
      expect(response.body.code).toBe('FORBIDDEN');
    }
  });

  describe('users', () => {
    it('lists and filters users', async () => {
      const user = await registerUser(app);
      const response = await asAdmin(
        'get',
        `/api/v1/admin/users?search=${encodeURIComponent(user.email)}`,
      ).expect(200);
      expect(response.body.meta.total).toBe(1);
      expect(response.body.data[0]).toMatchObject({
        id: user.userId,
        role: 'USER',
        status: 'ACTIVE',
      });

      const admins = await asAdmin('get', '/api/v1/admin/users?role=ADMIN').expect(200);
      expect(admins.body.data.every((entry: { role: string }) => entry.role === 'ADMIN')).toBe(
        true,
      );
    });

    it('shows a user with subscription, usage and sessions', async () => {
      const user = await registerUser(app);
      const response = await asAdmin('get', `/api/v1/admin/users/${user.userId}`).expect(200);
      expect(response.body).toMatchObject({
        id: user.userId,
        subscription: { status: 'ACTIVE', plan: { code: 'free' } },
        usage: { limit: 20, used: 0 },
        activeSessions: 1,
      });
    });

    it('suspending a user signs them out everywhere and blocks login', async () => {
      const user = await registerUser(app);
      await asAdmin('patch', `/api/v1/admin/users/${user.userId}`)
        .send({ status: 'SUSPENDED' })
        .expect(200);

      await http().get('/api/v1/users/me').set(bearer(user.accessToken)).expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(403);

      await asAdmin('patch', `/api/v1/admin/users/${user.userId}`)
        .send({ status: 'ACTIVE' })
        .expect(200);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);
    });

    it('promotes a user and the new role applies to existing tokens immediately', async () => {
      const user = await registerUser(app);
      await http().get('/api/v1/admin/plans').set(bearer(user.accessToken)).expect(403);

      await asAdmin('patch', `/api/v1/admin/users/${user.userId}`)
        .send({ role: 'ADMIN' })
        .expect(200);
      await http().get('/api/v1/admin/plans').set(bearer(user.accessToken)).expect(200);

      await asAdmin('patch', `/api/v1/admin/users/${user.userId}`)
        .send({ role: 'USER' })
        .expect(200);
    });

    it('prevents admins from demoting, suspending or deleting themselves', async () => {
      const me = admin.userId;
      for (const body of [{ role: 'USER' }, { status: 'SUSPENDED' }]) {
        const response = await asAdmin('patch', `/api/v1/admin/users/${me}`).send(body).expect(422);
        expect(response.body.code).toBe('ADMIN_SELF_MODIFICATION');
      }
      await asAdmin('delete', `/api/v1/admin/users/${me}`).expect(422);
    });

    it('deletes a user', async () => {
      const user = await registerUser(app);
      await asAdmin('delete', `/api/v1/admin/users/${user.userId}`).expect(204);
      await asAdmin('get', `/api/v1/admin/users/${user.userId}`).expect(404);
    });
  });

  describe('subscriptions and plans', () => {
    it('assigns a plan and lists subscriptions with their users', async () => {
      const user = await registerUser(app);
      await asAdmin('put', `/api/v1/admin/users/${user.userId}/subscription`)
        .send({ planCode: 'premium' })
        .expect(200);

      const list = await asAdmin(
        'get',
        '/api/v1/admin/subscriptions?planCode=premium&status=ACTIVE&limit=100',
      ).expect(200);
      const entry = list.body.data.find(
        (subscription: { user: { id: string } }) => subscription.user.id === user.userId,
      );
      expect(entry).toMatchObject({
        status: 'ACTIVE',
        plan: { code: 'premium' },
        user: { email: user.email },
      });
    });

    it('edits plan limits and protects the default plan', async () => {
      const plans = await asAdmin('get', '/api/v1/admin/plans').expect(200);
      const free = plans.body.find((plan: { code: string }) => plan.code === 'free');
      const premium = plans.body.find((plan: { code: string }) => plan.code === 'premium');

      const updated = await asAdmin('patch', `/api/v1/admin/plans/${premium.id}`)
        .send({ requestLimit: 750 })
        .expect(200);
      expect(updated.body.requestLimit).toBe(750);
      await asAdmin('patch', `/api/v1/admin/plans/${premium.id}`)
        .send({ requestLimit: premium.requestLimit })
        .expect(200);

      const response = await asAdmin('patch', `/api/v1/admin/plans/${free.id}`)
        .send({ isActive: false })
        .expect(422);
      expect(response.body.code).toBe('PLAN_IS_DEFAULT');
    });
  });

  describe('observability', () => {
    it('returns dashboard statistics', async () => {
      const response = await asAdmin('get', '/api/v1/admin/dashboard/stats').expect(200);
      expect(response.body.users.total).toBeGreaterThan(0);
      expect(
        response.body.activeSubscriptionsByPlan.map(
          (entry: { planCode: string }) => entry.planCode,
        ),
      ).toEqual(['free', 'premium']);
      expect(response.body.usage.requestsToday).toBeGreaterThan(0);
      expect(response.body.providers.defaultProvider).toBeTruthy();
    });

    it('returns system health', async () => {
      const response = await asAdmin('get', '/api/v1/admin/system/health').expect(200);
      expect(response.body).toMatchObject({ status: 'ok', database: { status: 'up' } });
      expect(response.body.runtime.node).toMatch(/^v\d+/);
    });

    it('filters request logs', async () => {
      const user = await registerUser(app);
      await http().get('/api/v1/users/me').set(bearer(user.accessToken)).expect(200);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await asAdmin(
        'get',
        `/api/v1/admin/logs/requests?userId=${user.userId}&method=GET`,
      ).expect(200);
      expect(response.body.data[0]).toMatchObject({
        userId: user.userId,
        method: 'GET',
        route: '/api/v1/users/me',
        statusCode: 200,
      });
      expect(typeof response.body.data[0].id).toBe('string');
    });

    it('aggregates usage analytics by group', async () => {
      const response = await asAdmin(
        'get',
        '/api/v1/admin/analytics/usage?granularity=day&groupBy=status',
      ).expect(200);
      expect(response.body.totals.requests).toBeGreaterThan(0);
      expect(response.body.series.map((point: { key: string }) => point.key)).toEqual(
        expect.arrayContaining(['2xx']),
      );

      const bad = await asAdmin(
        'get',
        '/api/v1/admin/analytics/usage?from=2026-09-10&to=2026-09-01',
      ).expect(422);
      expect(bad.body.code).toBe('INVALID_DATE_RANGE');
      await asAdmin('get', '/api/v1/admin/analytics/usage?groupBy=password').expect(400);
    });
  });
});

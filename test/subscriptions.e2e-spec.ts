import { Controller, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { ConsumesQuota, Quota } from '../src/common/decorators/quota.decorators';
import { AppException } from '../src/common/errors/app.exception';
import { type QuotaReservation } from '../src/common/types/quota-reservation';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { QuotaService } from '../src/modules/subscriptions/services/quota.service';
import { SubscriptionsModule } from '../src/modules/subscriptions/subscriptions.module';
import { bearer, registerUser } from './utils/auth.helpers';
import { createTestApp } from './utils/create-test-app';

/** Probe endpoints that consume quota, standing in for chat and search. */
@Controller('test-quota')
class QuotaProbeController {
  constructor(private readonly quotaService: QuotaService) {}

  @Post('ok')
  @ConsumesQuota()
  ok(): { ok: true } {
    return { ok: true };
  }

  @Post('fail')
  @ConsumesQuota()
  async fail(@Quota() reservation: QuotaReservation): Promise<never> {
    await this.quotaService.refund(reservation);
    throw AppException.badRequest('UPSTREAM_FAILED', 'Simulated upstream failure');
  }
}

async function waitFor<T>(probe: () => Promise<T | null>, attempts = 20): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const value = await probe();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Condition not met in time');
}

describe('Subscriptions, quotas and usage logs (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp({
      controllers: [QuotaProbeController],
      imports: [SubscriptionsModule],
    });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('GET /plans is public and lists active plans cheapest first', async () => {
    const response = await http().get('/api/v1/plans').expect(200);
    expect(response.body.map((plan: { code: string }) => plan.code)).toEqual(['free', 'premium']);
  });

  it('shows the free subscription and full allowance for a new user', async () => {
    const user = await registerUser(app);

    const subscription = await http()
      .get('/api/v1/subscriptions/me')
      .set(bearer(user.accessToken))
      .expect(200);
    expect(subscription.body).toMatchObject({
      status: 'ACTIVE',
      plan: { code: 'free', requestLimit: 20 },
    });

    const usage = await http()
      .get('/api/v1/subscriptions/me/usage')
      .set(bearer(user.accessToken))
      .expect(200);
    expect(usage.body).toMatchObject({
      planCode: 'free',
      limit: 20,
      used: 0,
      remaining: 20,
      period: 'DAILY',
    });
  });

  it('upgrades and downgrades while keeping history', async () => {
    const user = await registerUser(app);

    await http()
      .patch('/api/v1/subscriptions/me')
      .set(bearer(user.accessToken))
      .send({ planCode: 'PREMIUM' })
      .expect(200);
    const again = await http()
      .patch('/api/v1/subscriptions/me')
      .set(bearer(user.accessToken))
      .send({ planCode: 'premium' })
      .expect(409);
    expect(again.body.code).toBe('PLAN_ALREADY_ACTIVE');

    await http()
      .patch('/api/v1/subscriptions/me')
      .set(bearer(user.accessToken))
      .send({ planCode: 'free' })
      .expect(200);
    const unknown = await http()
      .patch('/api/v1/subscriptions/me')
      .set(bearer(user.accessToken))
      .send({ planCode: 'gold' })
      .expect(404);
    expect(unknown.body.code).toBe('PLAN_NOT_FOUND');

    const history = await http()
      .get('/api/v1/subscriptions/me/history')
      .set(bearer(user.accessToken))
      .expect(200);
    expect(
      history.body.map(
        (entry: { status: string; plan: { code: string } }) => `${entry.plan.code}:${entry.status}`,
      ),
    ).toEqual(['free:ACTIVE', 'premium:CANCELED', 'free:CANCELED']);
  });

  describe('quota enforcement', () => {
    it('counts requests, exposes headers and blocks at the limit with Retry-After', async () => {
      const user = await registerUser(app);
      await prisma.usageCounter.deleteMany({ where: { userId: user.userId } });

      const first = await http()
        .post('/api/v1/test-quota/ok')
        .set(bearer(user.accessToken))
        .expect(201);
      expect(first.headers['x-quota-limit']).toBe('20');
      expect(first.headers['x-quota-remaining']).toBe('19');

      for (let index = 1; index < 20; index++) {
        await http().post('/api/v1/test-quota/ok').set(bearer(user.accessToken)).expect(201);
      }

      const blocked = await http()
        .post('/api/v1/test-quota/ok')
        .set(bearer(user.accessToken))
        .expect(429);
      expect(blocked.body.code).toBe('QUOTA_EXCEEDED');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

      const usage = await http()
        .get('/api/v1/subscriptions/me/usage')
        .set(bearer(user.accessToken))
        .expect(200);
      expect(usage.body).toMatchObject({ used: 20, remaining: 0 });

      // Upgrading raises the limit immediately.
      await http()
        .patch('/api/v1/subscriptions/me')
        .set(bearer(user.accessToken))
        .send({ planCode: 'premium' })
        .expect(200);
      await http().post('/api/v1/test-quota/ok').set(bearer(user.accessToken)).expect(201);
    });

    it('never exceeds the limit under concurrent requests', async () => {
      const user = await registerUser(app);
      const quotaService = app.get(QuotaService);

      const results = await Promise.allSettled(
        Array.from({ length: 35 }, () => quotaService.consume(user.userId)),
      );

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(20);
      const usage = await quotaService.getUsage(user.userId);
      expect(usage.used).toBe(20);
    });

    it('refunds the unit when the work fails', async () => {
      const user = await registerUser(app);

      await http().post('/api/v1/test-quota/fail').set(bearer(user.accessToken)).expect(400);

      const usage = await http()
        .get('/api/v1/subscriptions/me/usage')
        .set(bearer(user.accessToken))
        .expect(200);
      expect(usage.body.used).toBe(0);
    });

    it('does not consume quota for unauthenticated requests', async () => {
      await http().post('/api/v1/test-quota/ok').expect(401);
    });
  });

  describe('usage logging', () => {
    it('records one row per request with route pattern, status and error code', async () => {
      const user = await registerUser(app);
      const requestId = `usage-log-test-${Date.now()}`;

      await http()
        .patch('/api/v1/subscriptions/me')
        .set(bearer(user.accessToken))
        .set('x-request-id', requestId)
        .send({ planCode: 'gold' })
        .expect(404);

      const log = await waitFor(() => prisma.apiUsageLog.findFirst({ where: { requestId } }));
      expect(log).toMatchObject({
        userId: user.userId,
        method: 'PATCH',
        route: '/api/v1/subscriptions/me',
        statusCode: 404,
        errorCode: 'PLAN_NOT_FOUND',
      });
      expect(log.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('keeps usage logs but anonymizes them when the account is deleted', async () => {
      const user = await registerUser(app);
      const requestId = `usage-log-delete-${Date.now()}`;
      await http()
        .get('/api/v1/users/me')
        .set(bearer(user.accessToken))
        .set('x-request-id', requestId)
        .expect(200);
      await waitFor(() => prisma.apiUsageLog.findFirst({ where: { requestId } }));

      await http()
        .delete('/api/v1/users/me')
        .set(bearer(user.accessToken))
        .send({ password: user.password })
        .expect(204);

      const log = await prisma.apiUsageLog.findFirst({ where: { requestId } });
      expect(log?.userId).toBeNull();
    });
  });
});

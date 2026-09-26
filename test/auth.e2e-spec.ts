import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { sha256Hex } from '../src/infrastructure/security/opaque-tokens';
import { bearer, login, registerUser, TEST_PASSWORD, uniqueEmail } from './utils/auth.helpers';
import { createTestApp } from './utils/create-test-app';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('POST /auth/register', () => {
    it('creates a USER on the free plan and returns tokens without secrets', async () => {
      const email = uniqueEmail();
      const response = await http()
        .post('/api/v1/auth/register')
        .send({ email: `  ${email.toUpperCase()} `, password: TEST_PASSWORD, fullName: ' Jane ' })
        .expect(201);

      expect(response.body.user).toMatchObject({
        email,
        fullName: 'Jane',
        role: 'USER',
        emailVerified: false,
      });
      expect(response.body.tokens).toMatchObject({
        tokenType: 'Bearer',
        accessTokenExpiresIn: 900,
      });
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|refreshTokenHash/);

      const subscription = await prisma.subscription.findFirst({
        where: { userId: response.body.user.id, status: 'ACTIVE' },
        include: { plan: true },
      });
      expect(subscription?.plan.code).toBe('free');
    });

    it('rejects duplicate emails with EMAIL_ALREADY_REGISTERED', async () => {
      const { email } = await registerUser(app);
      const response = await http()
        .post('/api/v1/auth/register')
        .send({ email, password: TEST_PASSWORD, fullName: 'Dup' })
        .expect(409);
      expect(response.body.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('validates input and rejects unknown fields', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short', fullName: '', role: 'ADMIN' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      const fields = response.body.details.map((detail: { field: string }) => detail.field);
      expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'fullName', 'role']));
    });
  });

  describe('POST /auth/login', () => {
    it('returns the same error for unknown email and wrong password', async () => {
      const { email } = await registerUser(app);
      const wrongPassword = await http()
        .post('/api/v1/auth/login')
        .send({ email, password: 'Wrong-pass1' })
        .expect(401);
      const unknownEmail = await http()
        .post('/api/v1/auth/login')
        .send({ email: uniqueEmail(), password: 'Wrong-pass1' })
        .expect(401);

      expect(wrongPassword.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(unknownEmail.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it('blocks suspended accounts', async () => {
      const user = await registerUser(app);
      await prisma.user.update({ where: { id: user.userId }, data: { status: 'SUSPENDED' } });

      const response = await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(403);
      expect(response.body.code).toBe('AUTH_ACCOUNT_SUSPENDED');
    });
  });

  describe('protected routes', () => {
    it('rejects missing and malformed access tokens', async () => {
      await http().post('/api/v1/auth/logout').expect(401);
      const response = await http()
        .post('/api/v1/auth/logout')
        .set(bearer('not-a-jwt'))
        .expect(401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('refresh token rotation', () => {
    it('rotates the refresh token and rejects the previous one as reused', async () => {
      const user = await registerUser(app);

      const first = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      expect(first.body.refreshToken).not.toBe(user.refreshToken);

      const replay = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
      expect(replay.body.code).toBe('AUTH_REFRESH_TOKEN_REUSED');

      // Reuse revoked the whole session: the newest refresh and access tokens are dead too.
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.body.refreshToken })
        .expect(401);
      await http().get('/api/v1/auth/sessions').set(bearer(first.body.accessToken)).expect(401);
    });

    it('rejects garbage refresh tokens', async () => {
      const response = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'x'.repeat(40) })
        .expect(401);
      expect(response.body.code).toBe('AUTH_REFRESH_TOKEN_INVALID');
    });
  });

  describe('logout', () => {
    it('invalidates the access token immediately', async () => {
      const user = await registerUser(app);
      await http().get('/api/v1/auth/sessions').set(bearer(user.accessToken)).expect(200);

      await http().post('/api/v1/auth/logout').set(bearer(user.accessToken)).expect(204);

      await http().get('/api/v1/auth/sessions').set(bearer(user.accessToken)).expect(401);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });

    it('logout-all signs out every device', async () => {
      const user = await registerUser(app);
      const second = await login(app, user.email, user.password);

      await http().post('/api/v1/auth/logout-all').set(bearer(second.accessToken)).expect(204);

      await http().get('/api/v1/auth/sessions').set(bearer(user.accessToken)).expect(401);
      await http().get('/api/v1/auth/sessions').set(bearer(second.accessToken)).expect(401);
    });
  });

  describe('sessions', () => {
    it('lists own sessions and revokes another device', async () => {
      const user = await registerUser(app);
      const other = await login(app, user.email, user.password);

      const list = await http()
        .get('/api/v1/auth/sessions')
        .set(bearer(user.accessToken))
        .expect(200);
      expect(list.body).toHaveLength(2);
      const otherSession = list.body.find((session: { current: boolean }) => !session.current);

      await http()
        .delete(`/api/v1/auth/sessions/${otherSession.id}`)
        .set(bearer(user.accessToken))
        .expect(204);
      await http().get('/api/v1/auth/sessions').set(bearer(other.accessToken)).expect(401);
    });

    it("cannot revoke another user's session", async () => {
      const alice = await registerUser(app);
      const bob = await registerUser(app);
      const bobSessions = await http()
        .get('/api/v1/auth/sessions')
        .set(bearer(bob.accessToken))
        .expect(200);

      const response = await http()
        .delete(`/api/v1/auth/sessions/${bobSessions.body[0].id}`)
        .set(bearer(alice.accessToken))
        .expect(404);
      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('email verification', () => {
    async function issueKnownToken(userId: string): Promise<string> {
      const token = 'known-verification-token-for-e2e-tests-0001';
      await prisma.verificationToken.updateMany({
        where: { userId },
        data: { usedAt: new Date() },
      });
      await prisma.verificationToken.create({
        data: {
          userId,
          purpose: 'EMAIL_VERIFICATION',
          tokenHash: sha256Hex(token),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      return token;
    }

    it('stores a hashed verification token on registration', async () => {
      const user = await registerUser(app);
      const tokens = await prisma.verificationToken.findMany({ where: { userId: user.userId } });
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('verifies once and rejects reuse', async () => {
      const user = await registerUser(app);
      const token = await issueKnownToken(user.userId);

      await http().post('/api/v1/auth/verify-email').send({ token }).expect(200);
      const reuse = await http().post('/api/v1/auth/verify-email').send({ token }).expect(400);
      expect(reuse.body.code).toBe('AUTH_VERIFICATION_TOKEN_INVALID');

      const again = await http()
        .post('/api/v1/auth/resend-verification')
        .set(bearer(user.accessToken))
        .expect(409);
      expect(again.body.code).toBe('EMAIL_ALREADY_VERIFIED');
    });
  });
});

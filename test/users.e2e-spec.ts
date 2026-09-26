import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { bearer, login, registerUser } from './utils/auth.helpers';
import { createTestApp } from './utils/create-test-app';

describe('Users /users/me (e2e)', () => {
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

  it('returns the profile of the caller only', async () => {
    const user = await registerUser(app);
    const response = await http().get('/api/v1/users/me').set(bearer(user.accessToken)).expect(200);

    expect(response.body).toMatchObject({ id: user.userId, email: user.email, role: 'USER' });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('updates allowed fields and ignores nothing silently', async () => {
    const user = await registerUser(app);

    const updated = await http()
      .patch('/api/v1/users/me')
      .set(bearer(user.accessToken))
      .send({ fullName: 'Renamed', avatarUrl: 'https://cdn.example.com/a.png' })
      .expect(200);
    expect(updated.body).toMatchObject({
      fullName: 'Renamed',
      avatarUrl: 'https://cdn.example.com/a.png',
    });

    const cleared = await http()
      .patch('/api/v1/users/me')
      .set(bearer(user.accessToken))
      .send({ avatarUrl: null });
    expect(cleared.body.avatarUrl).toBeNull();

    const rejected = await http()
      .patch('/api/v1/users/me')
      .set(bearer(user.accessToken))
      .send({
        role: 'ADMIN',
        email: 'x@example.com',
        avatarUrl: 'http://insecure.example.com/a.png',
      })
      .expect(400);
    const fields = rejected.body.details.map((detail: { field: string }) => detail.field);
    expect(fields).toEqual(expect.arrayContaining(['role', 'email', 'avatarUrl']));
  });

  describe('PATCH /users/me/password', () => {
    it('changes the password and signs out other devices only', async () => {
      const user = await registerUser(app);
      const otherDevice = await login(app, user.email, user.password);
      const newPassword = 'Brand-new-pass-9';

      await http()
        .patch('/api/v1/users/me/password')
        .set(bearer(user.accessToken))
        .send({ currentPassword: user.password, newPassword })
        .expect(204);

      await http().get('/api/v1/users/me').set(bearer(user.accessToken)).expect(200);
      await http().get('/api/v1/users/me').set(bearer(otherDevice.accessToken)).expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(401);
      await login(app, user.email, newPassword);
    });

    it('rejects a wrong current password and an unchanged password', async () => {
      const user = await registerUser(app);

      const wrong = await http()
        .patch('/api/v1/users/me/password')
        .set(bearer(user.accessToken))
        .send({ currentPassword: 'Wrong-pass-1', newPassword: 'Another-pass-2' })
        .expect(422);
      expect(wrong.body.code).toBe('PASSWORD_INCORRECT');

      const same = await http()
        .patch('/api/v1/users/me/password')
        .set(bearer(user.accessToken))
        .send({ currentPassword: user.password, newPassword: user.password })
        .expect(422);
      expect(same.body.code).toBe('PASSWORD_UNCHANGED');
    });
  });

  describe('DELETE /users/me', () => {
    it('requires the password', async () => {
      const user = await registerUser(app);
      const response = await http()
        .delete('/api/v1/users/me')
        .set(bearer(user.accessToken))
        .send({ password: 'Wrong-pass-1' })
        .expect(422);
      expect(response.body.code).toBe('PASSWORD_INCORRECT');
    });

    it('deletes the account and its personal data', async () => {
      const user = await registerUser(app);

      await http()
        .delete('/api/v1/users/me')
        .set(bearer(user.accessToken))
        .send({ password: user.password })
        .expect(204);

      await http().get('/api/v1/users/me').set(bearer(user.accessToken)).expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(401);
      expect(await prisma.session.count({ where: { userId: user.userId } })).toBe(0);
      expect(await prisma.subscription.count({ where: { userId: user.userId } })).toBe(0);
    });

    it('refuses to delete the last admin', async () => {
      const admin = await login(app, 'admin@echogpt.test', 'Test!Admin-Password-2026');
      const response = await http()
        .delete('/api/v1/users/me')
        .set(bearer(admin.accessToken))
        .send({ password: 'Test!Admin-Password-2026' })
        .expect(422);
      expect(response.body.code).toBe('LAST_ADMIN');
    });
  });
});

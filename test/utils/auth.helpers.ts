import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export interface TestSession {
  userId: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export const TEST_PASSWORD = 'Str0ng-test-password';

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

export async function registerUser(
  app: INestApplication,
  email = uniqueEmail(),
): Promise<TestSession> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password: TEST_PASSWORD, fullName: 'Test User' })
    .expect(201);
  return {
    userId: response.body.user.id,
    email,
    password: TEST_PASSWORD,
    accessToken: response.body.tokens.accessToken,
    refreshToken: response.body.tokens.refreshToken,
  };
}

export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<TestSession> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return {
    userId: response.body.user.id,
    email,
    password,
    accessToken: response.body.tokens.accessToken,
    refreshToken: response.body.tokens.refreshToken,
  };
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

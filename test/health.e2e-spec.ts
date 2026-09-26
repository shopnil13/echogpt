import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { createTestApp } from './utils/create-test-app';

describe('Health and HTTP pipeline (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns ok with security headers and a request id', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('GET /api/v1/health/ready reports dependency status', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);

    expect(response.body.status).toBe('ok');
  });

  it('returns the standard error envelope and echoes a client request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .set('x-request-id', 'client-trace-0001')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      path: '/api/v1/does-not-exist',
      requestId: 'client-trace-0001',
    });
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('rejects malformed JSON with a request id attached', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/health')
      .set('content-type', 'application/json')
      .send('{bad')
      .expect(400);

    expect(response.body.code).toBe('BAD_REQUEST');
    expect(response.body.requestId).toMatch(/[0-9a-f-]{36}/);
  });

  it('replaces a malformed client request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'bad id with spaces')
      .expect(200);

    expect(response.headers['x-request-id']).not.toBe('bad id with spaces');
  });
});

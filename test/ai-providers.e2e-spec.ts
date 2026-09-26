import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { bearer, loginAdmin, registerUser, type TestSession } from './utils/auth.helpers';
import { createTestApp } from './utils/create-test-app';

const SECRET_KEY = 'sk-test-super-secret-key-abcd';

describe('AI providers (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: TestSession;
  let user: TestSession;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await loginAdmin(app);
    user = await registerUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  function createProvider(body: Record<string, unknown>) {
    return http().post('/api/v1/admin/providers').set(bearer(admin.accessToken)).send(body);
  }

  const validBody = (name: string) => ({
    name,
    type: 'ANTHROPIC',
    apiKey: SECRET_KEY,
    defaultModel: 'claude-opus-5',
    models: [{ name: 'claude-opus-5', displayName: 'Claude Opus 5' }, { name: 'claude-sonnet-5' }],
  });

  it('forbids non-admins from every admin provider route', async () => {
    const response = await http()
      .get('/api/v1/admin/providers')
      .set(bearer(user.accessToken))
      .expect(403);
    expect(response.body.code).toBe('FORBIDDEN');
    await createProvider({}).set(bearer(user.accessToken)).expect(403);
  });

  it('creates a provider with an encrypted, write-only key', async () => {
    const response = await createProvider(validBody(`Claude ${Date.now()}`)).expect(201);

    expect(response.body).toMatchObject({
      type: 'ANTHROPIC',
      hasApiKey: true,
      apiKeyLast4: 'abcd',
      isEnabled: false,
    });
    expect(response.body.models.map((model: { name: string }) => model.name)).toEqual([
      'claude-opus-5',
      'claude-sonnet-5',
    ]);
    expect(JSON.stringify(response.body)).not.toContain(SECRET_KEY);
    expect(response.body).not.toHaveProperty('apiKeyEncrypted');

    const stored = await prisma.aiProvider.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(stored.apiKeyEncrypted).toMatch(/^v1:/);
    expect(stored.apiKeyEncrypted).not.toContain(SECRET_KEY);
  });

  it('validates the default model, duplicate names and unsafe base URLs', async () => {
    const name = `Dup ${Date.now()}`;
    await createProvider(validBody(name)).expect(201);

    expect((await createProvider(validBody(name)).expect(409)).body.code).toBe(
      'PROVIDER_NAME_TAKEN',
    );
    expect(
      (await createProvider({ ...validBody(`X ${Date.now()}`), defaultModel: 'nope' }).expect(422))
        .body.code,
    ).toBe('PROVIDER_MODEL_NOT_ALLOWED');
    const ssrf = await createProvider({
      ...validBody(`Y ${Date.now()}`),
      baseUrl: 'https://169.254.169.254',
    }).expect(422);
    expect(ssrf.body.code).toBe('PROVIDER_BASE_URL_NOT_ALLOWED');
  });

  it('requires a key before enabling a real provider', async () => {
    const created = await createProvider({
      ...validBody(`NoKey ${Date.now()}`),
      apiKey: undefined,
    }).expect(201);
    const response = await http()
      .patch(`/api/v1/admin/providers/${created.body.id}/status`)
      .set(bearer(admin.accessToken))
      .send({ isEnabled: true })
      .expect(422);
    expect(response.body.code).toBe('PROVIDER_API_KEY_REQUIRED');
  });

  it('enables, makes default, protects the default, and hands the default back', async () => {
    const previousDefault = await prisma.aiProvider.findFirstOrThrow({
      where: { isDefault: true },
    });
    const created = await createProvider(validBody(`Default ${Date.now()}`)).expect(201);
    const id = created.body.id as string;
    const auth = bearer(admin.accessToken);

    const notEnabled = await http()
      .put(`/api/v1/admin/providers/${id}/default`)
      .set(auth)
      .expect(422);
    expect(notEnabled.body.code).toBe('PROVIDER_DISABLED');

    await http()
      .patch(`/api/v1/admin/providers/${id}/status`)
      .set(auth)
      .send({ isEnabled: true })
      .expect(200);
    const madeDefault = await http()
      .put(`/api/v1/admin/providers/${id}/default`)
      .set(auth)
      .expect(200);
    expect(madeDefault.body.isDefault).toBe(true);
    expect(await prisma.aiProvider.count({ where: { isDefault: true } })).toBe(1);

    const disable = await http()
      .patch(`/api/v1/admin/providers/${id}/status`)
      .set(auth)
      .send({ isEnabled: false })
      .expect(422);
    expect(disable.body.code).toBe('PROVIDER_IS_DEFAULT');
    expect(
      (await http().delete(`/api/v1/admin/providers/${id}`).set(auth).expect(422)).body.code,
    ).toBe('PROVIDER_IS_DEFAULT');

    await http().put(`/api/v1/admin/providers/${previousDefault.id}/default`).set(auth).expect(200);
    await http().delete(`/api/v1/admin/providers/${id}`).set(auth).expect(204);
    await http().get(`/api/v1/admin/providers/${id}`).set(auth).expect(404);
  });

  it('rotates the key and replaces the model list', async () => {
    const created = await createProvider(validBody(`Rotate ${Date.now()}`)).expect(201);
    const response = await http()
      .patch(`/api/v1/admin/providers/${created.body.id}`)
      .set(bearer(admin.accessToken))
      .send({ apiKey: 'sk-new-key-wxyz', models: [{ name: 'claude-opus-5' }] })
      .expect(200);

    expect(response.body).toMatchObject({ apiKeyLast4: 'wxyz', health: { status: 'UNKNOWN' } });
    expect(response.body.models).toHaveLength(1);
  });

  it('runs a health check and stores the result', async () => {
    const mock = await prisma.aiProvider.findFirstOrThrow({ where: { type: 'MOCK' } });
    const response = await http()
      .post(`/api/v1/admin/providers/${mock.id}/health-check`)
      .set(bearer(admin.accessToken))
      .expect(200);

    expect(response.body).toMatchObject({ status: 'HEALTHY', error: null });
    const stored = await prisma.aiProvider.findUniqueOrThrow({ where: { id: mock.id } });
    expect(stored.healthStatus).toBe('HEALTHY');
  });

  it('shows users only enabled providers without operational fields', async () => {
    const response = await http()
      .get('/api/v1/providers')
      .set(bearer(user.accessToken))
      .expect(200);

    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].isDefault).toBe(true);
    for (const provider of response.body) {
      expect(Object.keys(provider).sort()).toEqual([
        'defaultModel',
        'id',
        'isDefault',
        'models',
        'name',
        'type',
      ]);
    }
  });
});

import { validateEnv } from './env.validation';

const REQUIRED = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv({ ...REQUIRED });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      SWAGGER_ENABLED: true,
      SEARCH_ENGINE: 'mock',
    });
  });

  it('disables Swagger by default in production', () => {
    expect(validateEnv({ ...REQUIRED, NODE_ENV: 'production' }).SWAGGER_ENABLED).toBe(false);
    expect(
      validateEnv({ ...REQUIRED, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED,
    ).toBe(true);
  });

  it('lists every problem at once', () => {
    expect(() =>
      validateEnv({ JWT_ACCESS_SECRET: 'short', ENCRYPTION_KEY: 'bm90LTMyLWJ5dGVz' }),
    ).toThrow(/DATABASE_URL[\s\S]*JWT_ACCESS_SECRET[\s\S]*ENCRYPTION_KEY/);
  });

  it('requires dependent settings', () => {
    expect(() => validateEnv({ ...REQUIRED, SEARCH_ENGINE: 'tavily' })).toThrow(/TAVILY_API_KEY/);
    expect(() => validateEnv({ ...REQUIRED, MAIL_TRANSPORT: 'smtp' })).toThrow(/SMTP_HOST/);
  });
});

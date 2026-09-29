import { validateEnv } from './env.validation';

const REQUIRED = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};

const PRODUCTION = {
  ...REQUIRED,
  NODE_ENV: 'production',
  MAIL_TRANSPORT: 'smtp',
  SMTP_HOST: 'smtp.example.com',
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
    expect(validateEnv({ ...PRODUCTION }).SWAGGER_ENABLED).toBe(false);
    expect(validateEnv({ ...PRODUCTION, SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED).toBe(true);
  });

  it('requires the SMTP mail transport in production', () => {
    const production = { ...REQUIRED, NODE_ENV: 'production' };
    expect(() => validateEnv(production)).toThrow(/MAIL_TRANSPORT" must be smtp in production/);
    expect(() => validateEnv({ ...production, MAIL_TRANSPORT: 'log' })).toThrow(
      /MAIL_TRANSPORT" must be smtp in production/,
    );
    expect(validateEnv({ ...PRODUCTION }).MAIL_TRANSPORT).toBe('smtp');
    expect(validateEnv({ ...REQUIRED }).MAIL_TRANSPORT).toBe('log');
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

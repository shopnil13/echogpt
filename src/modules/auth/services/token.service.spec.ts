import { JwtService } from '@nestjs/jwt';

import { type AuthConfig } from '../../../config/auth.config';
import { TokenService } from './token.service';

const config = { jwtAccessTtlSeconds: 900, refreshTokenTtlDays: 30 } as AuthConfig;

describe('TokenService', () => {
  const service = new TokenService(new JwtService({ secret: 'x'.repeat(32) }), config);
  const sessionId = '0192f0c4-8a3e-7c1e-9d2b-5b1f3a9c2e10';

  it('round-trips refresh tokens', () => {
    const { secret, hash } = service.createRefreshSecret();
    const token = service.formatRefreshToken(sessionId, secret);

    expect(service.parseRefreshToken(token)).toEqual({ sessionId, secret });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(secret);
  });

  it.each([
    ['empty', ''],
    ['no separator', 'abc'],
    ['bad session id', `not-a-uuid.${'a'.repeat(43)}`],
    ['short secret', `${sessionId}.short`],
    ['illegal characters', `${sessionId}.${'a'.repeat(42)}!`],
  ])('rejects malformed tokens (%s)', (_label, token) => {
    expect(service.parseRefreshToken(token)).toBeNull();
  });

  it('computes refresh expiry from the configured TTL', () => {
    const from = new Date('2026-09-26T00:00:00.000Z');
    expect(service.refreshTokenExpiry(from).toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });
});

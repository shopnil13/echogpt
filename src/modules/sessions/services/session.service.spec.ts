import { AppException } from '../../../common/errors/app.exception';
import { SessionRevokeReason } from '../../../generated/prisma/enums';
import { sha256Hex } from '../../../infrastructure/security/opaque-tokens';
import { type SessionsRepository, type SessionWithUser } from '../repositories/sessions.repository';
import { SessionService } from './session.service';
import { type TokenService } from './token.service';

const SESSION_ID = '0192f0c4-8a3e-7c1e-9d2b-5b1f3a9c2e10';
const SECRET = 'a'.repeat(43);

function buildSession(overrides: Partial<SessionWithUser> = {}): SessionWithUser {
  return {
    id: SESSION_ID,
    userId: 'user-1',
    refreshTokenHash: sha256Hex(SECRET),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user: {
      id: 'user-1',
      email: 'jane@example.com',
      status: 'ACTIVE',
      emailVerifiedAt: null,
      role: { name: 'USER' },
    },
    ...overrides,
  };
}

describe('SessionService.rotate', () => {
  let repository: jest.Mocked<Pick<SessionsRepository, 'findWithUser' | 'rotate' | 'revoke'>>;
  let service: SessionService;

  beforeEach(() => {
    repository = { findWithUser: jest.fn(), rotate: jest.fn(), revoke: jest.fn() };
    const tokenService = {
      parseRefreshToken: jest.fn((token: string) =>
        token === 'bad' ? null : { sessionId: SESSION_ID, secret: token.split('.')[1] },
      ),
      createRefreshSecret: jest.fn(() => ({
        secret: 'b'.repeat(43),
        hash: sha256Hex('b'.repeat(43)),
      })),
      formatRefreshToken: jest.fn((id: string, secret: string) => `${id}.${secret}`),
    } as unknown as TokenService;
    service = new SessionService(repository as unknown as SessionsRepository, tokenService);
  });

  async function rotateExpectingCode(token: string, code: string): Promise<void> {
    await expect(service.rotate(token)).rejects.toMatchObject({ code });
  }

  it('rotates a valid token', async () => {
    repository.findWithUser.mockResolvedValue(buildSession());
    repository.rotate.mockResolvedValue(true);

    const result = await service.rotate(`${SESSION_ID}.${SECRET}`);

    expect(result.refreshToken).toBe(`${SESSION_ID}.${'b'.repeat(43)}`);
    expect(repository.rotate).toHaveBeenCalledWith(
      SESSION_ID,
      sha256Hex(SECRET),
      sha256Hex('b'.repeat(43)),
    );
  });

  it('rejects malformed, unknown, revoked and expired sessions without revoking', async () => {
    await rotateExpectingCode('bad', 'AUTH_REFRESH_TOKEN_INVALID');

    repository.findWithUser.mockResolvedValueOnce(null);
    await rotateExpectingCode(`${SESSION_ID}.${SECRET}`, 'AUTH_REFRESH_TOKEN_INVALID');

    repository.findWithUser.mockResolvedValueOnce(buildSession({ revokedAt: new Date() }));
    await rotateExpectingCode(`${SESSION_ID}.${SECRET}`, 'AUTH_REFRESH_TOKEN_INVALID');

    repository.findWithUser.mockResolvedValueOnce(
      buildSession({ expiresAt: new Date(Date.now() - 1) }),
    );
    await rotateExpectingCode(`${SESSION_ID}.${SECRET}`, 'AUTH_REFRESH_TOKEN_INVALID');

    expect(repository.revoke).not.toHaveBeenCalled();
  });

  it('revokes the session when a rotated secret is replayed', async () => {
    repository.findWithUser.mockResolvedValue(buildSession());

    await rotateExpectingCode(`${SESSION_ID}.${'c'.repeat(43)}`, 'AUTH_REFRESH_TOKEN_REUSED');
    expect(repository.revoke).toHaveBeenCalledWith(SESSION_ID, SessionRevokeReason.REUSE_DETECTED);
    expect(repository.rotate).not.toHaveBeenCalled();
  });

  it('treats a lost concurrent rotation as invalid, not as theft', async () => {
    repository.findWithUser.mockResolvedValue(buildSession());
    repository.rotate.mockResolvedValue(false);

    await rotateExpectingCode(`${SESSION_ID}.${SECRET}`, 'AUTH_REFRESH_TOKEN_INVALID');
    expect(repository.revoke).not.toHaveBeenCalled();
  });

  it('revokes and rejects sessions of suspended users', async () => {
    const session = buildSession();
    session.user.status = 'SUSPENDED';
    repository.findWithUser.mockResolvedValue(session);

    const error = await service
      .rotate(`${SESSION_ID}.${SECRET}`)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe('AUTH_ACCOUNT_SUSPENDED');
    expect(repository.revoke).toHaveBeenCalledWith(SESSION_ID, SessionRevokeReason.USER_SUSPENDED);
  });
});

describe('SessionService.resolveAuthenticatedUser', () => {
  it('rejects sessions that belong to a different subject', async () => {
    const repository = { findWithUser: jest.fn().mockResolvedValue(buildSession()) };
    const service = new SessionService(
      repository as unknown as SessionsRepository,
      {} as TokenService,
    );

    await expect(service.resolveAuthenticatedUser(SESSION_ID, 'someone-else')).resolves.toBeNull();
    await expect(service.resolveAuthenticatedUser(SESSION_ID, 'user-1')).resolves.toMatchObject({
      id: 'user-1',
      role: 'USER',
      sessionId: SESSION_ID,
      emailVerified: false,
    });
  });
});

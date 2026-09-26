import { Injectable, Logger } from '@nestjs/common';

import { type RoleName } from '../../../common/constants/roles.constants';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { type ClientInfo } from '../../../common/types/client-info';
import { SessionRevokeReason, UserStatus } from '../../../generated/prisma/enums';
import { type DbClient } from '../../../infrastructure/prisma/prisma.types';
import { hexDigestsEqual, sha256Hex } from '../../../infrastructure/security/opaque-tokens';
import {
  type SessionSummary,
  SessionsRepository,
  type SessionWithUser,
} from '../repositories/sessions.repository';
import { TokenService } from './token.service';

export interface IssuedSession {
  sessionId: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface RotatedSession extends IssuedSession {
  user: SessionWithUser['user'];
}

/**
 * Owns the session lifecycle: creation, refresh-token rotation with reuse detection,
 * revocation, and the per-request session check used by the JWT strategy.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly tokenService: TokenService,
  ) {}

  async create(userId: string, client: ClientInfo): Promise<IssuedSession> {
    const { secret, hash } = this.tokenService.createRefreshSecret();
    const expiresAt = this.tokenService.refreshTokenExpiry();
    const sessionId = await this.sessionsRepository.create({
      userId,
      refreshTokenHash: hash,
      userAgent: client.userAgent,
      ipAddress: client.ipAddress,
      expiresAt,
    });
    return {
      sessionId,
      refreshToken: this.tokenService.formatRefreshToken(sessionId, secret),
      refreshTokenExpiresAt: expiresAt,
    };
  }

  /**
   * Validates a refresh token and replaces its secret. Presenting a secret that no longer
   * matches an active session means the token was already rotated, i.e. it was copied:
   * the session is revoked so both the attacker and the victim must sign in again.
   */
  async rotate(refreshToken: string): Promise<RotatedSession> {
    const parsed = this.tokenService.parseRefreshToken(refreshToken);
    if (!parsed) throw this.invalidRefreshToken();

    const session = await this.sessionsRepository.findWithUser(parsed.sessionId);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw this.invalidRefreshToken();
    }

    const presentedHash = sha256Hex(parsed.secret);
    if (!hexDigestsEqual(presentedHash, session.refreshTokenHash)) {
      await this.sessionsRepository.revoke(session.id, SessionRevokeReason.REUSE_DETECTED);
      this.logger.warn(
        { userId: session.userId, sessionId: session.id },
        'Refresh token reuse detected',
      );
      throw AppException.unauthorized(
        ErrorCode.AUTH_REFRESH_TOKEN_REUSED,
        'Refresh token was already used; the session has been revoked',
      );
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      await this.sessionsRepository.revoke(session.id, SessionRevokeReason.USER_SUSPENDED);
      throw AppException.forbidden(ErrorCode.AUTH_ACCOUNT_SUSPENDED, 'Account is suspended');
    }

    const next = this.tokenService.createRefreshSecret();
    const rotated = await this.sessionsRepository.rotate(session.id, presentedHash, next.hash);
    // Lost a race with a concurrent refresh of the same token: not theft, so do not revoke.
    if (!rotated) throw this.invalidRefreshToken();

    return {
      user: session.user,
      sessionId: session.id,
      refreshToken: this.tokenService.formatRefreshToken(session.id, next.secret),
      refreshTokenExpiresAt: session.expiresAt,
    };
  }

  /** Per-request check: the access token's session must still be active and belong to the subject. */
  async resolveAuthenticatedUser(
    sessionId: string,
    userId: string,
  ): Promise<AuthenticatedUser | null> {
    const session = await this.sessionsRepository.findWithUser(sessionId);
    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      return null;
    }
    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role.name as RoleName,
      sessionId: session.id,
      emailVerified: session.user.emailVerifiedAt !== null,
    };
  }

  listActive(userId: string): Promise<SessionSummary[]> {
    return this.sessionsRepository.listActiveForUser(userId, new Date());
  }

  async revoke(sessionId: string, userId: string, reason: SessionRevokeReason): Promise<void> {
    const revoked = await this.sessionsRepository.revoke(sessionId, reason, userId);
    if (!revoked) throw AppException.notFound(ErrorCode.SESSION_NOT_FOUND, 'Session not found');
  }

  revokeAll(
    userId: string,
    reason: SessionRevokeReason,
    exceptSessionId?: string,
    db?: DbClient,
  ): Promise<number> {
    return this.sessionsRepository.revokeAllForUser(userId, reason, exceptSessionId, db);
  }

  private invalidRefreshToken(): AppException {
    return AppException.unauthorized(
      ErrorCode.AUTH_REFRESH_TOKEN_INVALID,
      'Refresh token is invalid or expired',
    );
  }
}

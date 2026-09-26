import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { type RoleName } from '../../../common/constants/roles.constants';
import { authConfig, type AuthConfig } from '../../../config/auth.config';
import { generateOpaqueToken, sha256Hex } from '../../../infrastructure/security/opaque-tokens';

/** Claims carried by access tokens. `sid` binds the token to a server-side session (ADR-005). */
export interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: RoleName;
}

export interface IssuedAccessToken {
  token: string;
  expiresIn: number;
}

export interface RefreshSecret {
  secret: string;
  hash: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFRESH_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
  ) {}

  async issueAccessToken(payload: AccessTokenPayload): Promise<IssuedAccessToken> {
    const token = await this.jwtService.signAsync(payload);
    return { token, expiresIn: this.config.jwtAccessTtlSeconds };
  }

  createRefreshSecret(): RefreshSecret {
    const secret = generateOpaqueToken();
    return { secret, hash: sha256Hex(secret) };
  }

  /** Refresh tokens are opaque to clients: `<sessionId>.<secret>`. */
  formatRefreshToken(sessionId: string, secret: string): string {
    return `${sessionId}.${secret}`;
  }

  parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
    const separator = token.indexOf('.');
    if (separator <= 0) return null;
    const sessionId = token.slice(0, separator);
    const secret = token.slice(separator + 1);
    if (!UUID_PATTERN.test(sessionId) || !REFRESH_SECRET_PATTERN.test(secret)) return null;
    return { sessionId, secret };
  }

  refreshTokenExpiry(from: Date = new Date()): Date {
    const ttlMs = this.config.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
    return new Date(from.getTime() + ttlMs);
  }
}

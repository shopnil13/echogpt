import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppException } from '../../../common/errors/app.exception';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { authConfig, type AuthConfig } from '../../../config/auth.config';
import { SessionService } from '../../sessions/services/session.service';
import { type AccessTokenPayload } from '../../sessions/services/token.service';

/**
 * Verifies the JWT signature and claims, then confirms the bound session is still active.
 * The role comes from the database, so role changes and revocations apply immediately.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(authConfig.KEY) config: AuthConfig,
    private readonly sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwtAccessSecret,
      algorithms: ['HS256'],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      ignoreExpiration: false,
    });
  }

  async validate(payload: Partial<AccessTokenPayload>): Promise<AuthenticatedUser> {
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw AppException.unauthorized();
    }
    const user = await this.sessionService.resolveAuthenticatedUser(payload.sid, payload.sub);
    if (!user) throw AppException.unauthorized();
    return user;
  }
}

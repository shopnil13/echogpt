import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { authConfig, type AuthConfig } from '../../config/auth.config';
import { SessionsRepository } from './repositories/sessions.repository';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';

/**
 * Session and token lifecycle. Kept separate from AuthModule so lower-level modules
 * (users, admin) can revoke sessions without depending on authentication flows.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (config: AuthConfig) => ({
        secret: config.jwtAccessSecret,
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.jwtAccessTtlSeconds,
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        },
      }),
    }),
  ],
  providers: [SessionsRepository, SessionService, TokenService],
  exports: [SessionService, TokenService],
})
export class SessionsModule {}

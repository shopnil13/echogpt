import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { authConfig, type AuthConfig } from '../../config/auth.config';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SessionsRepository } from './repositories/sessions.repository';
import { VerificationTokensRepository } from './repositories/verification-tokens.repository';
import { AuthService } from './services/auth.service';
import { EmailVerificationService } from './services/email-verification.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule,
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
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    TokenService,
    EmailVerificationService,
    SessionsRepository,
    VerificationTokensRepository,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    EmailVerifiedGuard,
  ],
  exports: [SessionService, JwtAuthGuard, RolesGuard, EmailVerifiedGuard],
})
export class AuthModule {}

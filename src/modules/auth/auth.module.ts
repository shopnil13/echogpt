import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { MailModule } from '../../infrastructure/mail/mail.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { VerificationTokensRepository } from './repositories/verification-tokens.repository';
import { AuthService } from './services/auth.service';
import { EmailVerificationService } from './services/email-verification.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [UsersModule, SessionsModule, MailModule, PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    VerificationTokensRepository,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    EmailVerifiedGuard,
  ],
  exports: [JwtAuthGuard, RolesGuard, EmailVerifiedGuard],
})
export class AuthModule {}

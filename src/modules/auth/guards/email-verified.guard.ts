import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { REQUIRE_VERIFIED_EMAIL_KEY } from '../../../common/decorators/auth.decorators';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { authConfig, type AuthConfig } from '../../../config/auth.config';

/** Enforces `@RequireVerifiedEmail()` only when REQUIRE_EMAIL_VERIFICATION=true. */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.requireEmailVerification) return true;
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_EMAIL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>().user;
    if (!user?.emailVerified) {
      throw AppException.forbidden(
        ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
        'Verify your email address to use this feature',
      );
    }
    return true;
  }
}

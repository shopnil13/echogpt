import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

import type { RoleName } from '../constants/roles.constants';
import type { AuthenticatedUser } from '../types/authenticated-user';
import type { ClientInfo } from '../types/client-info';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';
export const REQUIRE_VERIFIED_EMAIL_KEY = 'auth:requireVerifiedEmail';
export const AUTH_THROTTLE_KEY = 'auth:throttle';

const MAX_USER_AGENT_LENGTH = 512;

/** Opts a route out of the global JWT guard. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given roles (checked by RolesGuard). */
export const Roles = (...roles: RoleName[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** Requires a verified email when REQUIRE_EMAIL_VERIFICATION=true. */
export const RequireVerifiedEmail = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_VERIFIED_EMAIL_KEY, true);

/** Applies the stricter `auth` throttler (login, register, refresh, verification). */
export const AuthThrottle = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTH_THROTTLE_KEY, true);

/** Injects the authenticated user resolved by the JWT strategy. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);

/** Injects the caller's IP address and user agent. */
export const Client = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientInfo => {
    const request = context.switchToHttp().getRequest<Request>();
    const userAgent = request.headers['user-agent'];
    return {
      ipAddress: request.ip ?? null,
      userAgent: userAgent ? userAgent.slice(0, MAX_USER_AGENT_LENGTH) : null,
    };
  },
);

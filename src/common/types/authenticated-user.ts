import type { RoleName } from '../constants/roles.constants';

/** Identity attached to `request.user` by the JWT strategy after the session is verified. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: RoleName;
  sessionId: string;
  emailVerified: boolean;
}

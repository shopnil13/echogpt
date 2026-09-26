import { type RoleName } from '../../../common/constants/roles.constants';
import { type UserProfileResponseDto } from '../dto/responses/user-profile.response.dto';
import { type UserProfileRecord } from '../repositories/users.repository';

/** Explicit allowlist of fields exposed to clients. */
export function toUserProfileResponse(user: UserProfileRecord): UserProfileResponseDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    role: user.role.name as RoleName,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

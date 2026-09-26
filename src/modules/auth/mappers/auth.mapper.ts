import { toUserProfileResponse } from '../../users/mappers/user.mapper';
import { type AuthResponseDto } from '../dto/responses/auth.response.dto';
import { type SessionResponseDto } from '../dto/responses/session.response.dto';
import { type SessionSummary } from '../repositories/sessions.repository';
import { type AuthResult } from '../services/auth.service';

export function toAuthResponse(result: AuthResult): AuthResponseDto {
  return { user: toUserProfileResponse(result.user), tokens: result.tokens };
}

export function toSessionResponse(
  session: SessionSummary,
  currentSessionId: string,
): SessionResponseDto {
  return { ...session, current: session.id === currentSessionId };
}

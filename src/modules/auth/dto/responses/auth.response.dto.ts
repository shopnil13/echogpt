import { ApiProperty } from '@nestjs/swagger';

import { UserProfileResponseDto } from '../../../users/dto/responses/user-profile.response.dto';
import { AuthTokensResponseDto } from './auth-tokens.response.dto';

export class AuthResponseDto {
  @ApiProperty({ type: UserProfileResponseDto })
  user: UserProfileResponseDto;

  @ApiProperty({ type: AuthTokensResponseDto })
  tokens: AuthTokensResponseDto;
}

import { ApiProperty } from '@nestjs/swagger';

import { SubscriptionResponseDto } from '../../../subscriptions/dto/responses/subscription.response.dto';
import { UsageResponseDto } from '../../../subscriptions/dto/responses/usage.response.dto';
import { UserProfileResponseDto } from '../responses/user-profile.response.dto';

export class AdminUserDetailResponseDto extends UserProfileResponseDto {
  @ApiProperty({ type: SubscriptionResponseDto })
  subscription: SubscriptionResponseDto;

  @ApiProperty({ type: UsageResponseDto })
  usage: UsageResponseDto;

  @ApiProperty({ example: 2, description: 'Active sessions (signed-in devices)' })
  activeSessions: number;
}

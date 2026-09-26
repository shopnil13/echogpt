import { ApiProperty } from '@nestjs/swagger';

import { PlanResponseDto } from '../responses/plan.response.dto';
import { SubscriptionResponseDto } from '../responses/subscription.response.dto';

export class SubscriptionUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ example: 'Jane Doe' })
  fullName: string;
}

export class AdminSubscriptionResponseDto extends SubscriptionResponseDto {
  @ApiProperty({ type: SubscriptionUserDto })
  user: SubscriptionUserDto;
}

export class AdminPlanResponseDto extends PlanResponseDto {
  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

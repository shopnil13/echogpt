import { ApiProperty } from '@nestjs/swagger';

import { SubscriptionStatus } from '../../../../generated/prisma/enums';
import { PlanResponseDto } from './plan.response.dto';

export class SubscriptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: SubscriptionStatus, example: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @ApiProperty({ type: PlanResponseDto })
  plan: PlanResponseDto;

  @ApiProperty({ format: 'date-time', example: '2026-09-26T10:00:00.000Z' })
  currentPeriodStart: Date;

  @ApiProperty({ nullable: true, type: String, format: 'date-time', example: null })
  currentPeriodEnd: Date | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time', example: null })
  canceledAt: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

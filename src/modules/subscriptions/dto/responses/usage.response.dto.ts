import { ApiProperty } from '@nestjs/swagger';

import { LimitPeriod } from '../../../../generated/prisma/enums';

export class UsageResponseDto {
  @ApiProperty({ example: 'free' })
  planCode: string;

  @ApiProperty({ enum: LimitPeriod, example: LimitPeriod.DAILY })
  period: LimitPeriod;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 7 })
  used: number;

  @ApiProperty({ example: 13 })
  remaining: number;

  @ApiProperty({ format: 'date-time', example: '2026-09-26T00:00:00.000Z' })
  periodStart: Date;

  @ApiProperty({ format: 'date-time', example: '2026-09-27T00:00:00.000Z' })
  resetsAt: Date;
}

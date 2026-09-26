import { ApiProperty } from '@nestjs/swagger';

import { LimitPeriod } from '../../../../generated/prisma/enums';

export class PlanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'premium' })
  code: string;

  @ApiProperty({ example: 'Premium' })
  name: string;

  @ApiProperty({ nullable: true, type: String, example: 'Higher daily allowance for power users' })
  description: string | null;

  @ApiProperty({ description: 'Price in the smallest currency unit', example: 999 })
  priceCents: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ description: 'Requests allowed per period', example: 500 })
  requestLimit: number;

  @ApiProperty({ enum: LimitPeriod, example: LimitPeriod.DAILY })
  limitPeriod: LimitPeriod;
}

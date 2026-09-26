import { ApiProperty } from '@nestjs/swagger';

import { ProviderHealthStatus } from '../../../../generated/prisma/enums';

export class HealthCheckResponseDto {
  @ApiProperty({ enum: ProviderHealthStatus, example: ProviderHealthStatus.HEALTHY })
  status: ProviderHealthStatus;

  @ApiProperty({ nullable: true, type: Number, example: 214 })
  latencyMs: number | null;

  @ApiProperty({ format: 'date-time' })
  checkedAt: Date;

  @ApiProperty({
    nullable: true,
    type: String,
    example: null,
    description: 'Sanitized upstream error when unhealthy',
  })
  error: string | null;
}

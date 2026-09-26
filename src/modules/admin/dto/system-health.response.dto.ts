import { ApiProperty } from '@nestjs/swagger';

import { ProviderHealthStatus } from '../../../generated/prisma/enums';

class DependencyStatusDto {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' }) status: 'up' | 'down';
  @ApiProperty({ nullable: true, type: Number, example: 2 }) latencyMs: number | null;
}

class ProviderHealthSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Anthropic Claude' }) name: string;
  @ApiProperty({ example: true }) isEnabled: boolean;
  @ApiProperty({ example: true }) isDefault: boolean;
  @ApiProperty({ enum: ProviderHealthStatus }) healthStatus: ProviderHealthStatus;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) lastCheckedAt: Date | null;
}

class RuntimeDto {
  @ApiProperty({ example: 'v22.23.1' }) node: string;
  @ApiProperty({ example: 'production' }) environment: string;
  @ApiProperty({ example: '0.1.0' }) version: string;
  @ApiProperty({ example: 86400, description: 'Process uptime in seconds' }) uptimeSeconds: number;
  @ApiProperty({ example: 182, description: 'Resident set size in MiB' }) memoryRssMb: number;
  @ApiProperty({ example: 96 }) heapUsedMb: number;
}

export class SystemHealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' }) status: 'ok' | 'degraded';
  @ApiProperty({ format: 'date-time' }) checkedAt: Date;
  @ApiProperty({ type: DependencyStatusDto }) database: DependencyStatusDto;
  @ApiProperty({ type: RuntimeDto }) runtime: RuntimeDto;
  @ApiProperty({ type: ProviderHealthSummaryDto, isArray: true })
  providers: ProviderHealthSummaryDto[];
}

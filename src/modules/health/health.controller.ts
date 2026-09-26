import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

import { PrismaHealthIndicator } from '../../infrastructure/prisma/prisma-health.indicator';

const HEAP_LIMIT_BYTES = 512 * 1024 * 1024;

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly database: PrismaHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Returns 200 while the process is running.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Checks dependencies required to serve traffic.',
  })
  @ApiServiceUnavailableResponse({ description: 'One or more dependencies are unhealthy' })
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', HEAP_LIMIT_BYTES),
    ]);
  }
}

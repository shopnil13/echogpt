import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Standard error envelope returned by every endpoint on failure. */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'NOT_FOUND', description: 'Stable machine-readable error code' })
  code: string;

  @ApiProperty({ example: 'Resource not found' })
  message: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Extra context, e.g. field-level validation errors',
    example: null,
  })
  details: unknown;

  @ApiProperty({ example: '/api/v1/resource/0192f0c4-8a3e-7c1e-9d2b-5b1f3a9c2e10' })
  path: string;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '4f0c8a2e-1b3d-4c5e-9f6a-7b8c9d0e1f2a' })
  requestId: string;
}

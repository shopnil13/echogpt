import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ format: 'uuid', example: '0192f0c4-8a3e-7c1e-9d2b-5b1f3a9c2e10' })
  id: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0',
  })
  userAgent: string | null;

  @ApiProperty({ nullable: true, type: String, example: '203.0.113.7' })
  ipAddress: string | null;

  @ApiProperty({ example: true, description: 'True for the session making this request' })
  current: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  lastUsedAt: Date;

  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;
}

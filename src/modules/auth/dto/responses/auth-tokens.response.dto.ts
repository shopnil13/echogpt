import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTkyZjBjNCJ9.signature',
  })
  accessToken: string;

  @ApiProperty({ description: 'Access token lifetime in seconds', example: 900 })
  accessTokenExpiresIn: number;

  @ApiProperty({
    example: '0192f0c4-8a3e-7c1e-9d2b-5b1f3a9c2e10.dGhpcy1pcy1hbi1leGFtcGxlLXNlY3JldC12YWx1ZTEyMzQ',
  })
  refreshToken: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-26T10:00:00.000Z' })
  refreshTokenExpiresAt: Date;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';
}

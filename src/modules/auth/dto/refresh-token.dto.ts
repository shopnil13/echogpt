import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token returned by login, register or the previous refresh',
    example: '0192f0c4-8a3e-7c1e-9d2b-5b1f3a9c2e10.dGhpcy1pcy1hbi1leGFtcGxlLXNlY3JldC12YWx1ZTEyMzQ',
  })
  @IsString()
  @Length(10, 200)
  refreshToken: string;
}

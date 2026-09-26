import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Token from the verification email',
    example: 'k3Jf9sQ0pX2vN7wYbC1dE5gH8iL4mO6rT0uZaB2cD3e',
  })
  @IsString()
  @Length(20, 100)
  token: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

import { NormalizeEmail } from '../../../common/transforms/string.transforms';
import { PASSWORD_MAX_LENGTH } from './register.dto';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Sup3r-secret-pass' })
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password: string;
}

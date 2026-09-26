import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

import { NormalizeEmail, Trim } from '../../../common/transforms/string.transforms';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
/** At least one letter and one digit. Length is checked separately. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;
export const PASSWORD_RULE_MESSAGE = 'password must contain at least one letter and one number';

export class RegisterDto {
  @ApiProperty({ example: 'jane@example.com', maxLength: 254 })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'Sup3r-secret-pass',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    description: 'At least 8 characters with one letter and one number',
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password: string;

  @ApiProperty({ example: 'Jane Doe', minLength: 1, maxLength: 100 })
  @Trim()
  @IsString()
  @Length(1, 100)
  fullName: string;
}

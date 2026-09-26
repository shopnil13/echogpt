import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

import { PASSWORD_MAX_LENGTH } from '../../../common/constants/password.constants';

export class DeleteAccountDto {
  @ApiProperty({
    description: 'Current password, required to confirm deletion',
    example: 'My-pass-123',
  })
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

import { TrimLowercase } from '../../../common/transforms/string.transforms';

export class ChangePlanDto {
  @ApiProperty({ example: 'premium', description: 'Code of the target plan (see GET /plans)' })
  @TrimLowercase()
  @IsString()
  @Length(1, 32)
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'planCode may contain lower-case letters, digits, "-" and "_"',
  })
  planCode: string;
}

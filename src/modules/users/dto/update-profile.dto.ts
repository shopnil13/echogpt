import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Length, MaxLength, ValidateIf } from 'class-validator';

import { Trim } from '../../../common/transforms/string.transforms';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe', minLength: 1, maxLength: 100 })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  fullName?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatars/jane.png',
    nullable: true,
    type: String,
    description: 'HTTPS URL of the avatar image; null removes it',
  })
  @ValidateIf((dto: UpdateProfileDto) => dto.avatarUrl !== null && dto.avatarUrl !== undefined)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;
}

import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

import { CreateProviderDto } from './create-provider.dto';

/** The provider type is immutable; `isEnabled` has its own endpoint. */
export class UpdateProviderDto extends PartialType(
  OmitType(CreateProviderDto, ['type', 'isEnabled', 'baseUrl'] as const),
) {
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: 'https://api.example-gateway.com/v1',
    description: 'HTTPS endpoint override; null restores the SDK default',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateProviderDto) => dto.baseUrl !== null)
  @IsString()
  @MaxLength(2048)
  baseUrl?: string | null;
}

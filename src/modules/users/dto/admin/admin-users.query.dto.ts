import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

import { RoleName } from '../../../../common/constants/roles.constants';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import { Trim } from '../../../../common/transforms/string.transforms';
import { UserStatus } from '../../../../generated/prisma/enums';

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'jane',
    description: 'Matches email or full name (case-insensitive)',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ enum: RoleName })
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

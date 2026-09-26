import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { RoleName } from '../../../../common/constants/roles.constants';
import { UserStatus } from '../../../../generated/prisma/enums';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ enum: RoleName, example: RoleName.ADMIN })
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @ApiPropertyOptional({
    enum: UserStatus,
    example: UserStatus.SUSPENDED,
    description: 'SUSPENDED signs the user out everywhere and blocks login',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

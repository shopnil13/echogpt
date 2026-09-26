import { ApiProperty } from '@nestjs/swagger';

import { RoleName } from '../../../../common/constants/roles.constants';
import { UserStatus } from '../../../../generated/prisma/enums';

export class UserProfileResponseDto {
  @ApiProperty({ format: 'uuid', example: '0192f0c4-8a3e-7c1e-9d2b-5b1f3a9c2e10' })
  id: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ example: 'Jane Doe' })
  fullName: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'https://cdn.example.com/avatars/jane.png',
  })
  avatarUrl: string | null;

  @ApiProperty({ enum: RoleName, example: RoleName.USER })
  role: RoleName;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    example: '2026-09-26T10:00:00.000Z',
  })
  lastLoginAt: Date | null;

  @ApiProperty({ format: 'date-time', example: '2026-09-20T08:30:00.000Z' })
  createdAt: Date;
}

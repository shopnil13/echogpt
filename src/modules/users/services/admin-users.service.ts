import { Injectable, Logger } from '@nestjs/common';

import { type Paginated, paginate } from '../../../common/dto/pagination.dto';
import { RoleName } from '../../../common/constants/roles.constants';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { SessionRevokeReason, UserStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SessionService } from '../../sessions/services/session.service';
import { type AdminUpdateUserDto } from '../dto/admin/admin-update-user.dto';
import { type AdminUsersQueryDto } from '../dto/admin/admin-users.query.dto';
import { type UserProfileRecord, UsersRepository } from '../repositories/users.repository';

/**
 * Administrative user management. Safeguards: an admin cannot demote, suspend or delete
 * themselves, which also guarantees at least one active admin always remains.
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionService: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  async list(query: AdminUsersQueryDto): Promise<Paginated<UserProfileRecord>> {
    const [items, total] = await this.usersRepository.listForAdmin({
      skip: query.skip,
      take: query.limit,
      search: query.search,
      role: query.role,
      status: query.status,
    });
    return paginate(items, total, query);
  }

  async get(id: string): Promise<UserProfileRecord> {
    const user = await this.usersRepository.findProfileById(id);
    if (!user) throw AppException.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
    return user;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    dto: AdminUpdateUserDto,
  ): Promise<UserProfileRecord> {
    const target = await this.get(id);
    const demoting = dto.role !== undefined && dto.role !== RoleName.ADMIN;
    const suspending = dto.status === UserStatus.SUSPENDED;
    if (actor.id === id && (demoting || suspending)) {
      throw this.selfModification('You cannot demote or suspend your own account');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.status !== undefined && dto.status !== target.status) {
        await this.usersRepository.updateStatus(id, dto.status, tx);
        if (suspending)
          await this.sessionService.revokeAll(
            id,
            SessionRevokeReason.USER_SUSPENDED,
            undefined,
            tx,
          );
      }
      if (dto.role !== undefined && dto.role !== (target.role.name as RoleName)) {
        await this.usersRepository.updateRole(id, dto.role, tx);
      }
      return this.usersRepository.findProfileById(id, tx);
    });

    this.logger.log(
      { actorId: actor.id, userId: id, role: dto.role, status: dto.status },
      'User updated by admin',
    );
    return updated ?? target;
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    if (actor.id === id)
      throw this.selfModification('Use DELETE /users/me to delete your own account');
    await this.get(id);
    await this.usersRepository.delete(id);
    this.logger.log({ actorId: actor.id, userId: id }, 'User deleted by admin');
  }

  countActiveSessions(userId: string): Promise<number> {
    return this.sessionService.listActive(userId).then((sessions) => sessions.length);
  }

  private selfModification(message: string): AppException {
    return AppException.unprocessable(ErrorCode.ADMIN_SELF_MODIFICATION, message);
  }
}

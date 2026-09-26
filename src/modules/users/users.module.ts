import { Module } from '@nestjs/common';

import { SessionsModule } from '../sessions/sessions.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminUsersController } from './controllers/admin-users.controller';
import { MeController } from './controllers/me.controller';
import { UsersRepository } from './repositories/users.repository';
import { AccountService } from './services/account.service';
import { AdminUsersService } from './services/admin-users.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [SessionsModule, SubscriptionsModule],
  controllers: [MeController, AdminUsersController],
  providers: [UsersRepository, UsersService, AccountService, AdminUsersService],
  exports: [UsersService],
})
export class UsersModule {}

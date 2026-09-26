import { Module } from '@nestjs/common';

import { SessionsModule } from '../sessions/sessions.module';
import { MeController } from './controllers/me.controller';
import { UsersRepository } from './repositories/users.repository';
import { AccountService } from './services/account.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [SessionsModule],
  controllers: [MeController],
  providers: [UsersRepository, UsersService, AccountService],
  exports: [UsersService],
})
export class UsersModule {}

import { Module } from '@nestjs/common';

import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ConversationsController } from './controllers/conversations.controller';
import { ConversationsRepository } from './repositories/conversations.repository';
import { MessagesRepository } from './repositories/messages.repository';
import { ChatService } from './services/chat.service';
import { ConversationsService } from './services/conversations.service';

@Module({
  imports: [AiProvidersModule, SubscriptionsModule],
  controllers: [ConversationsController],
  providers: [ConversationsRepository, MessagesRepository, ConversationsService, ChatService],
})
export class ChatModule {}

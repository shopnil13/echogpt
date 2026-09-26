import { ApiProperty } from '@nestjs/swagger';

import { MessageResponseDto } from './message.response.dto';

export class SendMessageResponseDto {
  @ApiProperty({ type: MessageResponseDto })
  userMessage: MessageResponseDto;

  @ApiProperty({ type: MessageResponseDto })
  assistantMessage: MessageResponseDto;
}

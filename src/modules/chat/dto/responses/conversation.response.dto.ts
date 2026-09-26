import { ApiProperty } from '@nestjs/swagger';

export class ConversationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Summarize the plot of Hamlet' })
  title: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'Preferred provider; null = default',
  })
  providerId: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'claude-opus-5' })
  model: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastMessageAt: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

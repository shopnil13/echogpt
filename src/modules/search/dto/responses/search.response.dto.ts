import { ApiProperty } from '@nestjs/swagger';

export class SearchResultItemDto {
  @ApiProperty({ example: 'The 10 best cafés in Lisbon' })
  title: string;

  @ApiProperty({ example: 'https://example.com/lisbon-coffee' })
  url: string;

  @ApiProperty({ example: 'From Alfama to Príncipe Real, these cafés…' })
  snippet: string;

  @ApiProperty({ nullable: true, type: Number, example: 0.92 })
  score: number | null;

  @ApiProperty({ nullable: true, type: String, example: null })
  publishedAt: string | null;
}

export class SearchResponseDto {
  @ApiProperty({ format: 'uuid', description: 'History entry id' })
  id: string;

  @ApiProperty({ example: 'best coffee in Lisbon' })
  query: string;

  @ApiProperty({ example: 'tavily' })
  engine: string;

  @ApiProperty({ type: SearchResultItemDto, isArray: true })
  results: SearchResultItemDto[];

  @ApiProperty({ nullable: true, type: String, example: 'Most guides recommend…' })
  summary: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: null,
    description:
      'Error code when the summary was requested but could not be produced (results are still returned)',
  })
  summaryError: string | null;

  @ApiProperty({ example: false, description: 'True when results came from the shared cache' })
  fromCache: boolean;

  @ApiProperty({ example: 184 })
  latencyMs: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class SearchHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'best coffee in Lisbon' })
  query: string;

  @ApiProperty({ example: 'tavily' })
  engine: string;

  @ApiProperty({ example: 5 })
  resultCount: number;

  @ApiProperty({ example: false })
  fromCache: boolean;

  @ApiProperty({ example: true })
  hasSummary: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class SearchHistoryDetailDto extends SearchHistoryItemDto {
  @ApiProperty({
    type: SearchResultItemDto,
    isArray: true,
    description: 'Snapshot taken at search time',
  })
  results: SearchResultItemDto[];

  @ApiProperty({ nullable: true, type: String })
  summary: string | null;
}

export class RecentSearchDto {
  @ApiProperty({ example: 'best coffee in Lisbon' })
  query: string;

  @ApiProperty({ format: 'date-time' })
  lastSearchedAt: Date;
}

export class SuggestionDto {
  @ApiProperty({ example: 'best coffee in lisbon' })
  query: string;

  @ApiProperty({ enum: ['history', 'popular'], example: 'history' })
  source: 'history' | 'popular';
}

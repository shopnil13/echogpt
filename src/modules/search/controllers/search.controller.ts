import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { CurrentUser, RequireVerifiedEmail } from '../../../common/decorators/auth.decorators';
import { ConsumesQuota, Quota } from '../../../common/decorators/quota.decorators';
import { type Paginated, PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ErrorCode } from '../../../common/errors/error-codes';
import { type AuthenticatedUser } from '../../../common/types/authenticated-user';
import { type QuotaReservation } from '../../../common/types/quota-reservation';
import { ACCESS_TOKEN_SECURITY } from '../../../infrastructure/swagger/swagger.setup';
import { abortOnClientDisconnect } from '../../chat/utils/sse-writer';
import {
  RecentSearchDto,
  SearchHistoryDetailDto,
  SearchHistoryItemDto,
  SearchResponseDto,
  SuggestionDto,
} from '../dto/responses/search.response.dto';
import { SearchDto } from '../dto/search.dto';
import { RecentQueryDto, SuggestionsQueryDto } from '../dto/suggestions.query.dto';
import { toHistoryDetail, toHistoryItem, toSearchResponse } from '../mappers/search.mapper';
import { SearchService } from '../services/search.service';

const ENTRY_NOT_FOUND = {
  status: HttpStatus.NOT_FOUND,
  code: ErrorCode.SEARCH_ENTRY_NOT_FOUND,
  message: 'Search history entry not found',
};

@ApiTags('Web search')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ConsumesQuota()
  @RequireVerifiedEmail()
  @ApiOperation({
    summary: 'Run an AI-assisted web search',
    description:
      'POST because it records history and consumes one request from your plan. Identical queries within the ' +
      'cache TTL are served from a shared cache (`fromCache: true`). With `summarize: true` the default AI ' +
      'provider summarizes the results; if that fails, results are still returned with `summaryError`.',
  })
  @ApiOkResponse({ type: SearchResponseDto })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    {
      status: HttpStatus.FORBIDDEN,
      code: ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
      message: 'Verify your email address to use this feature',
    },
    {
      status: HttpStatus.TOO_MANY_REQUESTS,
      code: ErrorCode.QUOTA_EXCEEDED,
      message: 'You have used all 20 requests of your Free plan for this period',
    },
    {
      status: HttpStatus.BAD_GATEWAY,
      code: ErrorCode.SEARCH_ENGINE_UNAVAILABLE,
      message: 'Web search is temporarily unavailable',
    },
  )
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SearchDto,
    @Quota() reservation: QuotaReservation,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SearchResponseDto> {
    const outcome = await this.searchService.search(
      user.id,
      dto,
      reservation,
      abortOnClientDisconnect(response),
    );
    return toSearchResponse(outcome);
  }

  @Get('history')
  @ApiOperation({ summary: 'List your search history', description: 'Newest first.' })
  @ApiPaginatedResponse(SearchHistoryItemDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<SearchHistoryItemDto>> {
    const page = await this.searchService.history(user.id, query);
    return { data: page.data.map(toHistoryItem), meta: page.meta };
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'Get a search history entry with its results snapshot' })
  @ApiOkResponse({ type: SearchHistoryDetailDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, ENTRY_NOT_FOUND)
  async historyEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SearchHistoryDetailDto> {
    return toHistoryDetail(await this.searchService.getHistoryEntry(id, user.id));
  }

  @Delete('history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a search history entry' })
  @ApiNoContentResponse({ description: 'Entry deleted' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, ENTRY_NOT_FOUND)
  deleteEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.searchService.deleteHistoryEntry(id, user.id);
  }

  @Delete('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear your whole search history' })
  @ApiNoContentResponse({ description: 'History cleared' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  clearHistory(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.searchService.clearHistory(user.id);
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Your recent distinct searches',
    description: 'One entry per query, newest first.',
  })
  @ApiOkResponse({ type: RecentSearchDto, isArray: true })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  recent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentQueryDto,
  ): Promise<RecentSearchDto[]> {
    return this.searchService.recent(user.id, query.limit);
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'Search suggestions for a prefix',
    description:
      'Your own past queries first, then popular queries. A query from other users is only suggested once ' +
      'enough distinct users have searched it (SEARCH_SUGGESTION_MIN_USERS), so private searches never leak.',
  })
  @ApiOkResponse({ type: SuggestionDto, isArray: true })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  suggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SuggestionsQueryDto,
  ): Promise<SuggestionDto[]> {
    return this.searchService.suggestions(user.id, query.q, query.limit);
  }
}

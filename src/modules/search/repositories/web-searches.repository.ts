import { Injectable } from '@nestjs/common';

import { type Prisma, type WebSearch } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export const searchSummarySelect = {
  id: true,
  query: true,
  engine: true,
  resultCount: true,
  fromCache: true,
  aiSummary: true,
  createdAt: true,
} satisfies Prisma.WebSearchSelect;

export type WebSearchSummary = Prisma.WebSearchGetPayload<{ select: typeof searchSummarySelect }>;

export interface RecentQuery {
  query: string;
  lastSearchedAt: Date;
}

/** Escapes LIKE wildcards so user input is matched literally. */
function likePrefix(prefix: string): string {
  return `${prefix.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

@Injectable()
export class WebSearchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.WebSearchUncheckedCreateInput): Promise<WebSearch> {
    return this.prisma.webSearch.create({ data });
  }

  findOwned(id: string, userId: string): Promise<WebSearch | null> {
    return this.prisma.webSearch.findFirst({ where: { id, userId } });
  }

  async list(userId: string, skip: number, take: number): Promise<[WebSearchSummary[], number]> {
    return this.prisma.$transaction([
      this.prisma.webSearch.findMany({
        where: { userId },
        select: searchSummarySelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.webSearch.count({ where: { userId } }),
    ]);
  }

  async deleteOwned(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.webSearch.deleteMany({ where: { id, userId } });
    return result.count === 1;
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.webSearch.deleteMany({ where: { userId } });
    return result.count;
  }

  /** The user's most recent distinct queries (latest spelling of each), newest first. */
  recentDistinct(userId: string, limit: number): Promise<RecentQuery[]> {
    return this.prisma.$queryRaw<RecentQuery[]>`
      SELECT query, last_searched_at AS "lastSearchedAt"
      FROM (
        SELECT DISTINCT ON (normalized_query) query, created_at AS last_searched_at
        FROM web_searches
        WHERE user_id = ${userId}::uuid
        ORDER BY normalized_query, created_at DESC
      ) latest
      ORDER BY last_searched_at DESC
      LIMIT ${limit}`;
  }

  /** The user's own past queries starting with the prefix, most recent first. */
  async userPrefixMatches(userId: string, prefix: string, limit: number): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ normalized_query: string }>>`
      SELECT normalized_query
      FROM web_searches
      WHERE user_id = ${userId}::uuid AND normalized_query LIKE ${likePrefix(prefix)}
      GROUP BY normalized_query
      ORDER BY max(created_at) DESC
      LIMIT ${limit}`;
    return rows.map((row) => row.normalized_query);
  }

  /**
   * Popular queries across all users. Only queries searched by at least `minUsers` distinct users
   * are returned, so one person's private searches never surface in someone else's suggestions.
   */
  async popularPrefixMatches(prefix: string, minUsers: number, limit: number): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ normalized_query: string }>>`
      SELECT normalized_query
      FROM web_searches
      WHERE normalized_query LIKE ${likePrefix(prefix)}
      GROUP BY normalized_query
      HAVING count(DISTINCT user_id) >= ${minUsers}
      ORDER BY count(*) DESC
      LIMIT ${limit}`;
    return rows.map((row) => row.normalized_query);
  }
}

import { Injectable } from '@nestjs/common';

import { type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { type SearchResultItem } from '../interfaces/web-search-engine.interface';

@Injectable()
export class SearchCacheRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns cached results when the entry exists and has not expired, counting the hit. */
  async takeValid(cacheKey: string, now: Date): Promise<SearchResultItem[] | null> {
    const result = await this.prisma.searchCacheEntry.updateMany({
      where: { cacheKey, expiresAt: { gt: now } },
      data: { hitCount: { increment: 1 } },
    });
    if (result.count === 0) return null;
    const entry = await this.prisma.searchCacheEntry.findUnique({
      where: { cacheKey },
      select: { results: true },
    });
    return (entry?.results as unknown as SearchResultItem[] | undefined) ?? null;
  }

  async upsert(data: {
    cacheKey: string;
    engine: string;
    normalizedQuery: string;
    results: SearchResultItem[];
    expiresAt: Date;
  }): Promise<void> {
    const results = data.results as unknown as Prisma.InputJsonValue;
    await this.prisma.searchCacheEntry.upsert({
      where: { cacheKey: data.cacheKey },
      create: { ...data, results },
      update: { results, expiresAt: data.expiresAt, hitCount: 0 },
    });
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.prisma.searchCacheEntry.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return result.count;
  }
}

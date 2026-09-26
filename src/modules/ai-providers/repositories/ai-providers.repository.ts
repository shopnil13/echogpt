import { Injectable } from '@nestjs/common';

import { type Prisma, type ProviderHealthStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export const providerWithModelsInclude = {
  models: { orderBy: { name: 'asc' } },
} satisfies Prisma.AiProviderInclude;

export type ProviderWithModels = Prisma.AiProviderGetPayload<{
  include: typeof providerWithModelsInclude;
}>;

export interface ModelData {
  name: string;
  displayName: string;
  isEnabled: boolean;
}

export type ProviderWriteData = Omit<
  Prisma.AiProviderUncheckedCreateInput,
  'id' | 'models' | 'createdAt' | 'updatedAt'
>;

export interface HealthRecord {
  healthStatus: ProviderHealthStatus;
  lastHealthCheckAt: Date;
  lastHealthLatencyMs: number | null;
  lastHealthError: string | null;
}

@Injectable()
export class AiProvidersRepository {
  constructor(private readonly prisma: PrismaService) {}

  listAll(): Promise<ProviderWithModels[]> {
    return this.prisma.aiProvider.findMany({
      include: providerWithModelsInclude,
      orderBy: { name: 'asc' },
    });
  }

  listEnabled(): Promise<ProviderWithModels[]> {
    return this.prisma.aiProvider.findMany({
      where: { isEnabled: true },
      include: providerWithModelsInclude,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  findById(id: string): Promise<ProviderWithModels | null> {
    return this.prisma.aiProvider.findUnique({ where: { id }, include: providerWithModelsInclude });
  }

  findDefault(): Promise<ProviderWithModels | null> {
    return this.prisma.aiProvider.findFirst({
      where: { isDefault: true },
      include: providerWithModelsInclude,
    });
  }

  create(data: ProviderWriteData, models: ModelData[]): Promise<ProviderWithModels> {
    return this.prisma.aiProvider.create({
      data: { ...data, models: { create: models } },
      include: providerWithModelsInclude,
    });
  }

  /** Updates fields and, when `models` is given, replaces the model list in the same transaction. */
  update(
    id: string,
    data: Partial<ProviderWriteData>,
    models?: ModelData[],
  ): Promise<ProviderWithModels> {
    return this.prisma.$transaction(async (tx) => {
      if (models) {
        await tx.aiModel.deleteMany({ where: { providerId: id } });
        await tx.aiModel.createMany({
          data: models.map((model) => ({ ...model, providerId: id })),
        });
      }
      return tx.aiProvider.update({ where: { id }, data, include: providerWithModelsInclude });
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.aiProvider.delete({ where: { id } });
  }

  /** Moves the default flag atomically; the partial unique index forbids two defaults. */
  makeDefault(id: string): Promise<ProviderWithModels> {
    return this.prisma.$transaction(async (tx) => {
      await tx.aiProvider.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      return tx.aiProvider.update({
        where: { id },
        data: { isDefault: true },
        include: providerWithModelsInclude,
      });
    });
  }

  async recordHealth(id: string, health: HealthRecord): Promise<void> {
    await this.prisma.aiProvider.update({ where: { id }, data: health });
  }

  countByHealth(): Promise<
    Array<{ healthStatus: ProviderHealthStatus; isEnabled: boolean; _count: { _all: number } }>
  > {
    return this.prisma.aiProvider
      .groupBy({ by: ['healthStatus', 'isEnabled'], _count: { _all: true } })
      .then((rows) =>
        rows.map((row) => ({
          healthStatus: row.healthStatus,
          isEnabled: row.isEnabled,
          _count: row._count,
        })),
      );
  }
}

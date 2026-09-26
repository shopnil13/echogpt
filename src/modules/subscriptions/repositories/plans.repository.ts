import { Injectable } from '@nestjs/common';

import { type Plan } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class PlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActive(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: 'asc' } });
  }

  listAll(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ orderBy: { priceCents: 'asc' } });
  }

  findByCode(code: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { code } });
  }

  findById(id: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  update(
    id: string,
    data: Partial<
      Pick<
        Plan,
        'name' | 'description' | 'priceCents' | 'requestLimit' | 'limitPeriod' | 'isActive'
      >
    >,
  ): Promise<Plan> {
    return this.prisma.plan.update({ where: { id }, data });
  }
}

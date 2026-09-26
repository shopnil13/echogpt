import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

export interface TestAppExtras {
  /** Probe controllers mounted next to the real routes. */
  controllers?: Type[];
  /** Modules the probe controllers depend on. */
  imports?: Type[];
}

/**
 * Boots the real AppModule with the production HTTP pipeline (filters, pipes, guards).
 * `extra` lets a suite mount probe endpoints to exercise cross-cutting behaviour.
 */
export async function createTestApp(extra: TestAppExtras = {}): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...(extra.imports ?? [])],
    controllers: extra.controllers ?? [],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    bufferLogs: true,
  });
  configureApp(app);
  await app.init();
  return app;
}

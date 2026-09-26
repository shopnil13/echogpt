import 'reflect-metadata';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '../app.module';
import { API_PREFIX } from '../app.setup';
import { buildOpenApiDocument } from '../infrastructure/swagger/swagger.setup';

/**
 * Writes the OpenAPI document to docs/openapi.json without starting the HTTP server or
 * connecting to the database. Run from the compiled build (npm run openapi:export) so the
 * Swagger CLI plugin's schema metadata is included.
 */
async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const target = resolve(process.argv[2] ?? 'docs/openapi.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
  process.stdout.write(`OpenAPI document written to ${target}\n`);
}

void exportOpenApi();

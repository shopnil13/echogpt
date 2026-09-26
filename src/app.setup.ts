import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { REQUEST_ID_HEADER, requestIdMiddleware } from './common/middleware/request-id.middleware';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { appConfig, type AppConfig } from './config/app.config';
import { mapPrismaError } from './infrastructure/prisma/prisma-error.mapper';
import { setupSwagger } from './infrastructure/swagger/swagger.setup';

export const API_PREFIX = 'api';

/**
 * Applies every global HTTP concern. Shared by `main.ts` and the e2e tests so tests exercise
 * exactly the production pipeline.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<AppConfig>(appConfig.KEY);

  app.useLogger(app.get(Logger));
  app.flushLogs();

  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.useBodyParser('json', { limit: config.bodyLimit });
  app.useBodyParser('urlencoded', { limit: config.bodyLimit, extended: false });

  app.use(
    helmet({
      contentSecurityPolicy: {
        // Upgrading to https breaks Swagger UI assets on plain-http local and docker setups.
        directives: { upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null },
      },
    }),
  );
  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER, 'Retry-After'],
    credentials: false,
    maxAge: 600,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter([mapPrismaError]));
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    setupSwagger(app);
  }
}

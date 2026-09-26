import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { appConfig, type AppConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.validation';
import { LoggerModule } from './infrastructure/logger/logger.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env.NODE_ENV === 'test' ? ['.env.test'] : ['.env'],
      load: [appConfig, databaseConfig],
      validate: validateEnv,
    }),
    LoggerModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: AppConfig) => [
        { name: 'default', ttl: config.throttle.ttlMs, limit: config.throttle.limit },
      ],
    }),
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

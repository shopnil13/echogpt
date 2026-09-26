import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { appConfig, type AppConfig } from './config/app.config';
import { validateEnv } from './config/env.validation';
import { LoggerModule } from './infrastructure/logger/logger.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env.NODE_ENV === 'test' ? ['.env.test'] : ['.env'],
      load: [appConfig],
      validate: validateEnv,
    }),
    LoggerModule,
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

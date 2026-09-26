import {
  type ExecutionContext,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AUTH_THROTTLE_KEY } from './common/decorators/auth.decorators';
import { appConfig, type AppConfig } from './config/app.config';
import { authConfig, type AuthConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.validation';
import { mailConfig } from './config/mail.config';
import { aiConfig } from './config/ai.config';
import { LoggerModule } from './infrastructure/logger/logger.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AiProvidersModule } from './modules/ai-providers/ai-providers.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailVerifiedGuard } from './modules/auth/guards/email-verified.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { HealthModule } from './modules/health/health.module';
import { QuotaGuard } from './modules/subscriptions/guards/quota.guard';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsageLogMiddleware } from './modules/usage-logs/middleware/usage-log.middleware';
import { UsageLogsModule } from './modules/usage-logs/usage-logs.module';
import { UsersModule } from './modules/users/users.module';

function isAuthThrottled(context: ExecutionContext): boolean {
  return Reflect.getMetadata(AUTH_THROTTLE_KEY, context.getHandler()) === true;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env.NODE_ENV === 'test' ? ['.env.test'] : ['.env'],
      load: [appConfig, databaseConfig, authConfig, mailConfig, aiConfig],
      validate: validateEnv,
    }),
    LoggerModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [appConfig.KEY, authConfig.KEY],
      useFactory: (app: AppConfig, auth: AuthConfig) => [
        { name: 'default', ttl: app.throttle.ttlMs, limit: app.throttle.limit },
        // Stricter bucket, applied only to handlers marked @AuthThrottle().
        {
          name: 'auth',
          ttl: auth.throttle.ttlMs,
          limit: auth.throttle.limit,
          skipIf: (context) => !isAuthThrottled(context),
        },
      ],
    }),
    HealthModule,
    UsageLogsModule,
    UsersModule,
    AuthModule,
    SubscriptionsModule,
    AiProvidersModule,
  ],
  // Global guards run in this order: rate limit, authentication, role check, email verification,
  // quota. Quota is last so rejected requests never consume allowance.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_GUARD, useExisting: EmailVerifiedGuard },
    { provide: APP_GUARD, useExisting: QuotaGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(UsageLogMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { appConfig, type AppConfig } from '../../config/app.config';

export const SWAGGER_PATH = 'api/docs';
export const ACCESS_TOKEN_SECURITY = 'access-token';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('EchoGPT API')
    .setDescription(
      [
        'REST API for the EchoGPT multi-AI chat Chrome extension.',
        '',
        '**Authentication:** call `POST /auth/login`, then send `Authorization: Bearer <accessToken>`.',
        'Refresh with `POST /auth/refresh` before the access token expires.',
        '',
        '**Errors** always use the `ErrorResponseDto` envelope with a stable `code`.',
        '**Tracing:** send `x-request-id` to correlate logs; it is echoed back on every response.',
      ].join('\n'),
    )
    .setVersion(app.get<AppConfig>(appConfig.KEY).version)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, ACCESS_TOKEN_SECURITY)
    .build();

  return SwaggerModule.createDocument(app, config, { extraModels: [ErrorResponseDto] });
}

export function setupSwagger(app: INestApplication): void {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  });
}

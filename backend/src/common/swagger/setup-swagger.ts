import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Swagger UI path outside the versioned prefix. */
export const SWAGGER_PATH = 'docs';

/** Security scheme of the Everything agent token (HU-137), not of a user. */
export const AGENT_BEARER_AUTH = 'everything-agent';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Trackhive API')
    .setDescription(
      'API del sistema de gestión de solicitudes y citas del CLENA. ' +
        'Todas las rutas usan el prefijo /api/v1.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description:
          'Token del agente de Everything (EVERYTHING_AGENT_TOKEN), solo para los endpoints de ingesta',
      },
      AGENT_BEARER_AUTH,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
  });
}

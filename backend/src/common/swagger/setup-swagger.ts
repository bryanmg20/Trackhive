import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Ruta de la interfaz de Swagger fuera del prefijo versionado. */
export const SWAGGER_PATH = 'docs';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Trackhive API')
    .setDescription(
      'API del sistema de gestión de solicitudes y citas del CLENA. ' +
        'Todas las rutas usan el prefijo /api/v1.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
  });
}

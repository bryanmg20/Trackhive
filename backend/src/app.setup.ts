import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { setupSwagger } from './common/swagger/setup-swagger';
import { validationExceptionFactory } from './common/validation/validation-error.factory';

/** Prefijo global de la API versionada. */
export const API_PREFIX = 'api/v1';

/**
 * Configuración compartida por `main.ts` y las pruebas: prefijo, validación,
 * filtro de errores y Swagger.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  setupSwagger(app);
}

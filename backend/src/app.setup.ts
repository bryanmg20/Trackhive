import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { setupSwagger } from './common/swagger/setup-swagger';
import { validationExceptionFactory } from './common/validation/validation-error.factory';

/** Global prefix for the versioned API. */
export const API_PREFIX = 'api/v1';

/**
 * Configuration shared by `main.ts` and the tests: prefix, validation,
 * error filter and Swagger.
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

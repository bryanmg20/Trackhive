import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { BootstrapAdminJob } from './users/infrastructure/jobs/bootstrap-admin.job';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // Initial administrator from the .env (HU-42); a wrong .env stops here
  await app.get(BootstrapAdminJob).run();
  await app.listen(3000);
}
void bootstrap();

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MaterialsModule } from './materials/materials.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Loads the single .env at the repo root and expands ${VAR} references
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      expandVariables: true,
    }),
    // Runs the @Cron jobs, such as the daily purge of expired refresh tokens
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    HealthModule,
    MaterialsModule,
    NotificationsModule,
  ],
})
export class AppModule {}

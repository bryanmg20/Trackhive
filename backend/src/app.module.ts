import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
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
    PrismaModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}

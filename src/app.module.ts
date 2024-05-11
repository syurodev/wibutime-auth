import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppV1Module } from './v1/app.v1.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    AppV1Module,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

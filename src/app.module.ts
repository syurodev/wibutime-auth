import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppV1Module } from './v1/app.v1.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    AppV1Module,
    KafkaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from 'dotenv';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import {
  HttpException,
  HttpStatus,
  LogLevel,
  ValidationError,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';

import { ExceptionResponseDetail } from './utils/utils.exception.common/utils.exception.common';
import { KafkaGroupIdEnum } from './utils/utils.enums/kafka-group-id-enum';
import { join } from 'path';
import { AUTH_SERVICE_GRPC_PACKAGE_PACKAGE_NAME } from './proto/auth/auth';
config();

async function bootstrap() {
  process.env.TZ = 'Asia/Ho_Chi_Minh';

  const app = await NestFactory.create(AppModule, {
    logger: process.env.CONFIG_LOGGER_LEVEL.split(',').filter(
      (level: string): level is LogLevel => {
        return ['log', 'error', 'warn', 'debug', 'verbose'].includes(
          level as LogLevel,
        );
      },
    ),
  });

  //Kafka config
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [
          `${process.env.CONFIG_KAFKA_HOST}:${process.env.CONFIG_KAFKA_PORT}`,
        ],
      },
      consumer: {
        groupId: KafkaGroupIdEnum.AUTH_SERVICE,
      },
      producer: {
        createPartitioner: Partitioners.LegacyPartitioner,
      },
    },
  });

  //gRPC config
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: [AUTH_SERVICE_GRPC_PACKAGE_PACKAGE_NAME],
      protoPath: [join(__dirname, 'proto/auth/auth.proto')],
      url: `${process.env.CONFIG_GRPC_HOST}:${process.env.CONFIG_GRPC_PORT}`,
      loader: {
        keepCase: true,
      },
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (validationErrors: ValidationError[] = []): void => {
        throw new HttpException(
          new ExceptionResponseDetail(
            HttpStatus.BAD_REQUEST,
            Object.values(validationErrors[0].constraints)[0],
          ),
          HttpStatus.OK,
        );
      },
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.setGlobalPrefix('api'); // Thiết lập tiền tố toàn cầu là /api

  app.startAllMicroservices();

  await app.listen(process.env.SERVICE_PORT, '0.0.0.0');

  console.log(`Auth service is run ${await app.getUrl()}`);

  console.log(`
      ============================.ENV=======================

      SERVICE_PORT: ${process.env.SERVICE_PORT},
      CONFIG_KAFKA_HOST: ${process.env.CONFIG_KAFKA_HOST},
      CONFIG_KAFKA_PORT: ${process.env.CONFIG_KAFKA_PORT},
    `);
}
bootstrap();

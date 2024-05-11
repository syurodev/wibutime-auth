import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { KafkaTopicEnum } from 'src/common/enums/kafka-topic-enum';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka = new Kafka({
    brokers: [
      `${process.env.CONFIG_KAFKA_HOST}:${process.env.CONFIG_KAFKA_PORT}`,
    ],
  });

  private readonly producer: Producer = this.kafka.producer();

  async onModuleInit() {
    await this.producer.connect();
  }

  async produce(record: ProducerRecord) {
    await this.producer.send(record);
  }

  //Gửi log đến topic AUTH_LOGGER
  async sendAuthLogger(log: KafkaLogger) {
    await this.produce({
      topic: KafkaTopicEnum.AUTH_LOGGER,
      messages: [
        {
          value: JSON.stringify(log),
        },
      ],
    });
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }
}

import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [DatabaseModule, UserModule, AuthModule, MailModule],
  controllers: [],
  providers: [],
})
export class AppV1Module {}

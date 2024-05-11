import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserService } from '../user/user.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [JwtModule.register({}), MailModule],
  providers: [UserService, AuthService],
  controllers: [AuthController],
})
export class AuthModule {}

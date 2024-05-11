import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ToUserDTO } from './mail.dto/user.dto';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendVerificationEmail(user: ToUserDTO, code: number) {
    try {
      await this.mailerService.sendMail({
        to: user.email,
        // from: '"Support Team" <support@example.com>', // override default from
        subject: 'Welcome to Wibutime!',
        template: './verification-email', // `.hbs` extension is appended automatically
        context: {
          // ✏️ filling curly brackets with content
          name: user.name,
          code,
        },
      });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async sendVerificationForgotPassword(email: string, code: number) {
    try {
      await this.mailerService.sendMail({
        to: email,
        // from: '"Support Team" <support@example.com>', // override default from
        subject: 'Forgot Password',
        template: './forgot-password-email', // `.hbs` extension is appended automatically
        context: {
          // ✏️ filling curly brackets with content
          code,
        },
      });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async sendVerificationChangePassword(email: string, code: number) {
    try {
      await this.mailerService.sendMail({
        to: email,
        // from: '"Support Team" <support@example.com>', // override default from
        subject: 'Change Password',
        template: './change-password-email', // `.hbs` extension is appended automatically
        context: {
          // ✏️ filling curly brackets with content
          code,
        },
      });
    } catch (error) {
      throw new Error(error.message);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import * as moment from 'moment';

import { UserService } from '../user/user.service';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { FullTokenResponse, UserRegisterRequest } from 'src/proto/auth/auth';
import { AccountProviderEnum } from 'src/common/enums/account-provider.enum';
import { Password } from 'src/common/password/password.common';
import { HandleBase64 } from 'src/common/base64/handle-base64.common';
import { UserRoleEnum } from 'src/common/enums/user-roles.enums';
import { GenerateCode } from 'src/common/generate/generate-code.common';
import { KafkaProducerService } from 'src/kafka/producer.service';

@Injectable()
export class AuthService {
  constructor(
    //Kafka
    private readonly kafkaProducerService: KafkaProducerService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private mailService: MailService,
  ) {}

  // async googleLogin(userData: string) {
  //   const user: Profile = ParseGoogleProfile(userData);

  //   const existingUser = await this.userService.findOneUser(
  //     user.emails[0].value,
  //     false,
  //     false,
  //     true,
  //     true,
  //   );

  //   if (existingUser) {
  //     existingUser.backend_token = await this.generateJwt(
  //       existingUser.id,
  //       existingUser.email,
  //       existingUser.name,
  //     );
  //     return existingUser;
  //   }

  //   //Không tìm thấy user => tạo user
  //   const createdUser = await this.createUser({
  //     email: user.emails[0].value,
  //     email_verified: true,
  //     image: user.photos[0].value,
  //     provider: user.provider,
  //     name: user.displayName,
  //     created_at: new Date().getTime(),
  //     updated_at: new Date().getTime(),
  //   });

  //   if (createdUser && typeof createdUser !== 'string') {
  //     createdUser.backend_token = await this.generateJwt(
  //       createdUser.id,
  //       createdUser.email,
  //       existingUser.name,
  //     );
  //   }

  //   return createdUser ? createdUser : null;
  // }

  /**
   * @param userData Prisma.UserCreateInput
   * @returns UserResponse | null
   */
  async createUser(
    userData: UserRegisterRequest,
  ): Promise<UserResponse | string | null> {
    try {
      const existingUser = await this.databaseService.user.findFirst({
        where: {
          OR: [{ email: userData.email }, { username: userData.username }],
        },
      });

      if (existingUser) {
        return 'Email hoặc username đã tồn tại!';
      }

      if (
        userData.provider &&
        userData.provider === AccountProviderEnum.CREDENTIALS
      ) {
        //Nếu không phải là oauth thì kiểm tra và mã hoá mật khẩu
        //Nếu mật khẩu không hợp lệ -> dừng quá trình tạo tài khoản
        if (!userData.password || userData.password.trim().length < 6) {
          return 'Mật khẩu phải có ít nhất 6 ký tự!';
        }
        userData.password = String(
          await Password.bcryptPassword(
            await HandleBase64.decodePasswordBase64(userData.password),
          ),
        );
      }

      const role = await this.findRole(UserRoleEnum.USER);
      const createdUser: UserResponse = await this.databaseService.user.create({
        data: {
          ...userData,
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          roles: {
            connect: [{ id: role[0].id }], //Kết nối đến role USER
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          image: true,
          provider: true,
          email_verified: true,
          coins: true,
        },
      });

      if (createdUser) {
        //Ghi log
        await this.kafkaProducerService.sendAuthLogger({
          user_id: createdUser.id,
          actor: 'USER',
          log_date: moment().utcOffset('+07:00').toDate(),
          message: `Tạo người dùng với email: ${createdUser.email} thành công`,
          result: 'Tạo người dùng thành công',
          public: true,
          type: 'INFO',
          auth_action: 'REGISTER',
        });
        try {
          await this.sendVerificationEmail(createdUser.email, createdUser.name);

          //Ghi log
          await this.kafkaProducerService.sendAuthLogger({
            user_id: createdUser.id,
            actor: 'USER',
            log_date: moment().utcOffset('+07:00').toDate(),
            message: `Gửi mã xác nhận đến email: ${createdUser.email} thành công`,
            result: 'Gửi mã xác nhận thành công',
            public: true,
            type: 'INFO',
            auth_action: 'REGISTER',
          });
        } catch (error) {
          await this.databaseService.user.delete({
            where: {
              id: createdUser.id,
            },
          });

          //Ghi log
          await this.kafkaProducerService.sendAuthLogger({
            user_id: createdUser.id,
            actor: 'SYSTEM',
            log_date: moment().utcOffset('+07:00').toDate(),
            message: `Tạo người dùng với email ${createdUser.email} thành công nhưng gửi email xác nhận thất bại`,
            result: `Tài khoản đã tạo với email ${createdUser.email} đã bị xoá`,
            public: false,
            type: 'ERROR',
            error_message: error.message.toString(),
            auth_action: 'REGISTER',
          });

          return 'Tạo người dùng không thành công';
        }
      }

      return createdUser ? createdUser : 'Tạo người dùng không thành công';
    } catch (error) {
      //Ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Tạo người dùng với email: ${userData.email} không thành công`,
        result: 'Tạo người dùng không thành công',
        public: false,
        type: 'ERROR',
        error_message: error.message.toString(),
        auth_action: 'REGISTER',
      });

      console.error(error.message);
      return 'Tạo người dùng không thành công';
    }
  }

  /**
   * @param username
   * @param password
   * @returns { error?: { message: string }; success?: { data: UserResponse }; }
   */
  async credentialLogin(
    username: string,
    password: string,
  ): Promise<UserResponse | string | null> {
    try {
      const existingUser = await this.userService.findOneUser(
        username,
        false,
        true,
        true,
        true,
      );

      if (!existingUser) {
        return 'USER_NOT_FOUND';
      }

      if (await Password.comparePassword(password, existingUser.password)) {
        if (existingUser) {
          existingUser.backend_token = await this.generateJwt(
            existingUser.id,
            existingUser.email,
            existingUser.name,
          );
        }

        delete existingUser.password;

        //Ghi log
        await this.kafkaProducerService.sendAuthLogger({
          user_id: existingUser.id,
          actor: 'USER',
          log_date: moment().utcOffset('+07:00').toDate(),
          message: `Đăng nhập vào tài khoảng có email ${existingUser.email} thành công`,
          result: 'Đănh nhập thành công',
          public: true,
          type: 'INFO',
          auth_action: 'LOGIN',
        });

        return existingUser;
      } else {
        //Ghi log
        await this.kafkaProducerService.sendAuthLogger({
          user_id: existingUser.id,
          actor: 'USER',
          log_date: moment().utcOffset('+07:00').toDate(),
          message: `Đăng nhập vào tài khoảng có email ${existingUser.email} không thành công do sai mật khẩu`,
          result: 'Đănh nhập không thành công',
          public: true,
          type: 'ERROR',
          auth_action: 'LOGIN',
        });

        return 'INCORRECT_PASSWORD';
      }
    } catch (error) {
      //Ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Đăng nhập vào tài khoảng có email/username ${username} không thành công`,
        result: 'Đănh nhập không thành công',
        public: false,
        type: 'ERROR',
        auth_action: 'LOGIN',
        error_message: error.message.toString(),
      });

      console.log(error.message);
      return 'LOGIN_ERROR';
    }
  }

  async findRole(roleName?: string): Promise<Role[]> {
    const query: Prisma.RoleFindManyArgs = {};

    if (roleName) {
      query.where = { name: roleName }; // Khởi tạo query.where và gán giá trị cho nó
    }

    return await this.databaseService.role.findMany(query);
  }

  async generateJwt(
    userId: number,
    email: string,
    name: string,
    withRefreshToken: boolean = true,
  ): Promise<FullTokenResponse> {
    const payload = {
      sub: userId,
      email,
      name,
    };

    // Lấy thời gian hiện tại theo múi giờ +7
    const currentTime = moment().utcOffset('+07:00');

    // Cộng thêm 30 phút vào thời gian hiện tại
    const futureTime = currentTime.add(30, 'minutes');
    // Chuyển thời gian hiện tại thành số (milliseconds)
    const futureTimestamp = futureTime.valueOf();

    const result: FullTokenResponse = {
      access_token: await this.jwtService.signAsync(payload, {
        expiresIn: '30m', //Thời gian hết hạn
        secret: this.configService.get('CONFIG_JWT_SECRET'),
      }),
      expires_in: futureTimestamp.toString(),
    };

    if (withRefreshToken) {
      result.refresh_token = await this.jwtService.signAsync(payload, {
        expiresIn: '7d', //Thời gian hết hạn
        secret: this.configService.get('CONFIG_JWT_REFRESH_TOKEN'),
      });
    }

    return result;
  }

  /**
   * @param email string
   * @param name string
   */
  async sendVerificationEmail(email: string, name: string): Promise<boolean> {
    try {
      const code = GenerateCode.generateRandomSixDigitNumber();
      const expires = new Date().getTime() + 10 * 60 * 1000; // Thêm 10 phút vào thời điểm hiện tại

      const existingCode =
        await this.databaseService.verificationEmailCode.findUnique({
          where: { email: email },
        });

      if (existingCode) {
        await this.databaseService.verificationEmailCode.delete({
          where: { id: existingCode.id },
        });
      }

      await this.databaseService.verificationEmailCode.create({
        data: {
          code,
          email: email,
          expires,
        },
      });

      await this.mailService.sendVerificationEmail(
        {
          email: email,
          name: name,
        },
        code,
      );

      //Ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Gửi mã đến email ${email} thành công`,
        result: 'Gửi mã thành công',
        public: false,
        type: 'INFO',
        auth_action: 'SEND_CODE',
      });

      return true;
    } catch (error) {
      //Ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Gửi mã đến email ${email} không thành công`,
        result: 'Gửi mã không thành công',
        public: false,
        type: 'ERROR',
        auth_action: 'SEND_CODE',
        error_message: error.message.toString(),
      });

      console.error(error.message);
      return false;
    }
  }

  //Xác nhận email
  async verificationEmail(email: string, code: number): Promise<boolean> {
    try {
      const existingCode =
        await this.databaseService.verificationEmailCode.findUnique({
          where: { email },
        });

      if (!existingCode) {
        //Ghi log
        await this.kafkaProducerService.sendAuthLogger({
          user_id: null,
          actor: 'USER',
          log_date: moment().utcOffset('+07:00').toDate(),
          message: `Xác thực email ${email} không thành công do mã được truyền vào không tồn tại`,
          result: 'Xác thực email không thành công',
          public: true,
          type: 'ERROR',
          auth_action: 'VERIFICATION_EMAIL',
        });

        return null;
      }

      if (
        code === existingCode.code &&
        existingCode.expires > new Date().getTime()
      ) {
        await this.databaseService.verificationEmailCode.delete({
          where: { email },
        });

        const result = await this.databaseService.user.update({
          where: {
            email: email,
          },
          data: {
            email_verified: true,
          },
          select: {
            id: true,
          },
        });

        //Ghi log
        await this.kafkaProducerService.sendAuthLogger({
          user_id: result.id,
          actor: 'USER',
          log_date: moment().utcOffset('+07:00').toDate(),
          message: `Xác thực email ${email} thành công`,
          result: 'Xác thực email thành công',
          public: true,
          type: 'INFO',
          auth_action: 'VERIFICATION_EMAIL',
        });

        return true;
      }

      return false;
    } catch (error) {
      //Ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Xác thực email ${email} không thành công`,
        result: 'Xác thực email không thành công',
        public: false,
        type: 'ERROR',
        auth_action: 'VERIFICATION_EMAIL',
        error_message: error.message.toString(),
      });

      console.error(error.message);
      return null;
    }
  }

  //Gửi mã quên mật khẩu
  async forgotPassword(email: string): Promise<boolean> {
    try {
      const existingUser = await this.databaseService.user.findUnique({
        where: { email: email },
      });

      if (!existingUser) false;

      const code = GenerateCode.generateRandomSixDigitNumber();
      const expires = new Date().getTime() + 10 * 60 * 1000; // Thêm 10 phút vào thời điểm hiện tại

      const existingCode =
        await this.databaseService.forgotPasswordCode.findUnique({
          where: { email: email },
        });

      if (existingCode) {
        await this.databaseService.forgotPasswordCode.delete({
          where: { id: existingCode.id },
        });
      }

      await this.databaseService.forgotPasswordCode.create({
        data: {
          code,
          email: email,
          expires,
        },
      });

      await this.mailService.sendVerificationForgotPassword(email, code);
      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'USER',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Gửi mã xác thực đến ${email} thành công`,
        result: 'Gửi mã xác thực thành công',
        public: true,
        type: 'INFO',
        auth_action: 'SEND_CODE',
      });
      return true;
    } catch (error) {
      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Gửi mã xác thực đến ${email} không thành công`,
        result: 'Gửi mã xác thực không thành công',
        public: false,
        type: 'ERROR',
        auth_action: 'SEND_CODE',
        error_message: error.message.toString(),
      });

      console.log(error.message);
      return false;
    }
  }

  //Đặt lại mật khẩu
  async resetPassword(email: string, password: string) {
    try {
      const existingUser = await this.databaseService.user.findUnique({
        where: { email },
      });

      if (!existingUser) return false;

      const newPassword: string = String(
        await Password.bcryptPassword(
          await HandleBase64.decodePasswordBase64(password),
        ),
      );

      const result = await this.databaseService.user.update({
        where: { email: email },
        data: {
          password: newPassword,
        },
        select: {
          id: true,
        },
      });

      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: result.id,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Đặt lại mật khẩu tài khoản có email ${email} thành công`,
        result: 'Đặt lại mật khẩu thành công',
        public: true,
        type: 'INFO',
        auth_action: 'RESET_PASSWORD',
      });

      return true;
    } catch (error) {
      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Đặt lại mật khẩu tài khoản có email ${email} không thành công`,
        result: 'Đặt lại mật khẩu không thành công',
        public: false,
        type: 'ERROR',
        auth_action: 'RESET_PASSWORD',
        error_message: error.message.toString(),
      });
      console.error(error.message);
      return false;
    }
  }

  //Xác nhận mã quên mật khẩu
  async verificationForgotPassword(email: string, code: number) {
    try {
      const existingCode =
        await this.databaseService.forgotPasswordCode.findUnique({
          where: { email },
        });

      if (!existingCode) {
        return null;
      }

      if (
        Number(code) === existingCode.code &&
        existingCode.expires > new Date().getTime()
      ) {
        await this.databaseService.forgotPasswordCode.delete({
          where: { email },
        });

        //ghi log
        await this.kafkaProducerService.sendAuthLogger({
          user_id: null,
          actor: 'USER',
          log_date: moment().utcOffset('+07:00').toDate(),
          message: `Xác nhận mã đặt lại mật khẩu tài khoản có email ${email} thành công`,
          result: 'Xác nhận mã đặt lại mật khẩu thành công',
          public: true,
          type: 'INFO',
          auth_action: 'RESET_PASSWORD',
        });

        return true;
      }

      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'USER',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Xác nhận mã đặt lại mật khẩu tài khoản có email ${email} không thành công do code sai hoặc code hết hạn`,
        result: 'Xác nhận mã đặt lại mật khẩu không thành công',
        public: true,
        type: 'ERROR',
        auth_action: 'RESET_PASSWORD',
      });
      return false;
    } catch (error) {
      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Xác nhận mã đặt lại mật khẩu tài khoản có email ${email} không thành công`,
        result: 'Xác nhận mã đặt lại mật khẩu không thành công',
        public: false,
        type: 'ERROR',
        auth_action: 'RESET_PASSWORD',
        error_message: error.message.toString(),
      });
      console.error(error.message);
      return null;
    }
  }

  //Gửi mã đổi mật khẩu
  async changePassword(email: string) {
    try {
      const code = GenerateCode.generateRandomSixDigitNumber();
      const expires = new Date().getTime() + 10 * 60 * 1000; // Thêm 10 phút vào thời điểm hiện tại

      const existingCode =
        await this.databaseService.changePasswordCode.findUnique({
          where: { email: email },
        });

      if (existingCode) {
        await this.databaseService.changePasswordCode.delete({
          where: { id: existingCode.id },
        });
      }

      await this.databaseService.verificationEmailCode.create({
        data: {
          code,
          email: email,
          expires,
        },
      });

      await this.mailService.sendVerificationChangePassword(email, code);

      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'USER',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Gửi mã đổi mật khẩu tài khoản có email ${email} thành công`,
        result: 'Gửi mã đổi mật khẩu thành công',
        public: true,
        type: 'INFO',
        auth_action: 'CHANGE_PASSWORD',
      });

      return true;
    } catch (error) {
      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Gửi mã đổi mật khẩu tài khoản có email ${email} không thành công`,
        result: 'Gửi mã đổi mật khẩu không thành công',
        public: false,
        type: 'ERROR',
        auth_action: 'CHANGE_PASSWORD',
        error_message: error.message.toString(),
      });

      console.log(error.message);
      return false;
    }
  }

  //Xác nhận đổi mật khẩu
  async verificationChangePassword(email: string, code: number) {
    try {
      const existingCode =
        await this.databaseService.changePasswordCode.findUnique({
          where: { email },
        });

      if (!existingCode) {
        return null;
      }

      if (
        code === existingCode.code &&
        existingCode.expires > new Date().getTime()
      ) {
        await this.databaseService.changePasswordCode.delete({
          where: { email },
        });

        //ghi log
        await this.kafkaProducerService.sendAuthLogger({
          user_id: null,
          actor: 'USER',
          log_date: moment().utcOffset('+07:00').toDate(),
          message: `Xác nhận mã đổi mật khẩu tài khoản có email ${email} thành công`,
          result: 'Xác nhận mã đổi mật khẩu thành công',
          public: true,
          type: 'INFO',
          auth_action: 'RESET_PASSWORD',
        });

        return true;
      }

      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'USER',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Xác nhận mã đổi mật khẩu tài khoản có email ${email} không thành công do code sai hoặc code hết hạn`,
        result: 'Xác nhận mã đổi mật khẩu không thành công',
        public: true,
        type: 'ERROR',
        auth_action: 'CHANGE_PASSWORD',
      });

      return false;
    } catch (error) {
      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Xác nhận mã đổi mật khẩu tài khoản có email ${email} không thành công`,
        result: 'Xác nhận mã đổi mật khẩu không thành công',
        public: false,
        type: 'ERROR',
        auth_action: 'CHANGE_PASSWORD',
        error_message: error.message.toString(),
      });
      console.error(error.message);
      return null;
    }
  }

  //Đổi mật khẩu mới
  async changeNewPassword(
    email: string,
    oldPassword: string,
    password: string,
  ) {
    try {
      const existingUser = await this.databaseService.user.findUnique({
        where: { email },
      });

      if (!existingUser) return false;

      const oldPasswordBcrypt: string = String(
        await Password.bcryptPassword(
          await HandleBase64.decodePasswordBase64(oldPassword),
        ),
      );

      if (oldPasswordBcrypt !== existingUser.password) {
        //ghi log
        await this.kafkaProducerService.sendAuthLogger({
          user_id: existingUser.id,
          actor: 'USER',
          log_date: moment().utcOffset('+07:00').toDate(),
          message: `Đổi mật khẩu tài khoản có email ${email} không thành công do nhập mật khẩu cũ sai`,
          result: 'Đổi mật khẩu không thành công',
          public: true,
          type: 'ERROR',
          auth_action: 'CHANGE_PASSWORD',
        });

        return false;
      }

      const newPassword: string = String(
        await Password.bcryptPassword(
          await HandleBase64.decodePasswordBase64(password),
        ),
      );
      await this.databaseService.user.update({
        where: { email: email },
        data: {
          password: newPassword,
        },
        select: {
          id: true,
        },
      });

      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: existingUser.id,
        actor: 'USER',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Đổi mật khẩu tài khoản có email ${email} thành công`,
        result: 'Đổi mật khẩu thành công',
        public: true,
        type: 'INFO',
        auth_action: 'CHANGE_PASSWORD',
      });

      return true;
    } catch (error) {
      //ghi log
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Đổi mật khẩu tài khoản có email ${email} không thành công`,
        result: 'Đổi mật khẩu không thành công',
        public: true,
        type: 'ERROR',
        auth_action: 'CHANGE_PASSWORD',
        error_message: error.message.toString(),
      });

      console.error(error.message);
      return false;
    }
  }
}

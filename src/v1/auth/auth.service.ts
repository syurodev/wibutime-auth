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
   * Tạo một người dùng mới trong hệ thống.
   *
   * @param userData Thông tin của người dùng mới.
   * @returns Người dùng mới được tạo thành công hoặc thông báo lỗi nếu có.
   */
  async createUser(
    userData: UserRegisterRequest,
  ): Promise<UserResponse | string | null> {
    try {
      // Kiểm tra xem người dùng đã tồn tại hay chưa
      const existingUser = await this.databaseService.user.findFirst({
        where: {
          OR: [{ email: userData.email }, { username: userData.username }],
        },
      });

      if (existingUser) {
        // Trả về thông báo lỗi nếu email hoặc username đã tồn tại
        return 'Email hoặc username đã tồn tại!';
      }

      // Nếu người dùng sử dụng đăng nhập bằng tên người dùng và mật khẩu
      if (
        userData.provider &&
        userData.provider === AccountProviderEnum.CREDENTIALS
      ) {
        // Kiểm tra và mã hoá mật khẩu
        if (!userData.password || userData.password.trim().length < 6) {
          // Trả về thông báo lỗi nếu mật khẩu không hợp lệ
          return 'Mật khẩu phải có ít nhất 6 ký tự!';
        }
        userData.password = String(
          await Password.bcryptPassword(
            await HandleBase64.decodePasswordBase64(userData.password),
          ),
        );
      }

      // Tìm và lấy role cho người dùng
      const role = await this.findRole(UserRoleEnum.USER);

      // Tạo người dùng mới trong cơ sở dữ liệu
      const createdUser: UserResponse = await this.databaseService.user.create({
        data: {
          ...userData,
          created_at: new Date().getTime(),
          updated_at: new Date().getTime(),
          roles: {
            connect: [{ id: role[0].id }], // Kết nối đến role USER
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
        // Ghi log khi tạo người dùng thành công
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
          // Gửi email xác nhận đến người dùng
          await this.sendVerificationEmail(createdUser.email, createdUser.name);

          // Ghi log khi gửi email xác nhận thành công
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
          // Nếu gửi email xác nhận thất bại, xóa người dùng đã tạo và ghi log lỗi
          await this.databaseService.user.delete({
            where: {
              id: createdUser.id,
            },
          });

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
      // Ghi log khi tạo người dùng không thành công
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
   * Xử lý đăng nhập bằng tên người dùng và mật khẩu.
   *
   * @param username Tên người dùng hoặc email.
   * @param password Mật khẩu của người dùng.
   * @returns Thông tin người dùng hoặc mã lỗi nếu có.
   */
  async credentialLogin(
    username: string,
    password: string,
  ): Promise<UserResponse | string | null> {
    try {
      // Tìm kiếm người dùng trong cơ sở dữ liệu dựa trên tên người dùng hoặc email
      const existingUser = await this.userService.findOneUser(
        username,
        false,
        true,
        true,
        true,
      );

      if (!existingUser) {
        // Trả về mã lỗi nếu không tìm thấy người dùng
        return 'USER_NOT_FOUND';
      }

      // So sánh mật khẩu được cung cấp với mật khẩu trong cơ sở dữ liệu
      if (await Password.comparePassword(password, existingUser.password)) {
        // Nếu mật khẩu đúng, tạo JWT token cho người dùng và ghi log đăng nhập thành công
        if (existingUser) {
          existingUser.backend_token = await this.generateJwt(
            existingUser.id,
            existingUser.email,
            existingUser.name,
          );
        }

        delete existingUser.password; // Xóa mật khẩu trước khi trả về thông tin người dùng

        existingUser.backend_token = await this.generateJwt(
          existingUser.id,
          existingUser.email,
          existingUser.name,
          true,
        );

        // Ghi log đăng nhập thành công
        await this.kafkaProducerService.sendAuthLogger({
          user_id: existingUser.id,
          actor: 'USER',
          log_date: moment().utcOffset('+07:00').toDate(),
          message: `Đăng nhập vào tài khoảng có email ${existingUser.email} thành công`,
          result: 'Đăng nhập thành công',
          public: true,
          type: 'INFO',
          auth_action: 'LOGIN',
        });

        return existingUser; // Trả về thông tin người dùng sau khi đăng nhập thành công
      } else {
        // Ghi log đăng nhập không thành công vì sai mật khẩu
        await this.kafkaProducerService.sendAuthLogger({
          user_id: existingUser.id,
          actor: 'USER',
          log_date: moment().utcOffset('+07:00').toDate(),
          message: `Đăng nhập vào tài khoảng có email ${existingUser.email} không thành công do sai mật khẩu`,
          result: 'Đăng nhập không thành công',
          public: true,
          type: 'ERROR',
          auth_action: 'LOGIN',
        });

        return 'INCORRECT_PASSWORD'; // Trả về mã lỗi nếu mật khẩu không đúng
      }
    } catch (error) {
      // Ghi log khi xảy ra lỗi trong quá trình đăng nhập
      await this.kafkaProducerService.sendAuthLogger({
        user_id: null,
        actor: 'SYSTEM',
        log_date: moment().utcOffset('+07:00').toDate(),
        message: `Đăng nhập vào tài khoảng có email/username ${username} không thành công`,
        result: 'Đăng nhập không thành công',
        public: false,
        type: 'ERROR',
        auth_action: 'LOGIN',
        error_message: error.message.toString(),
      });

      console.error(error.message);
      return 'LOGIN_ERROR'; // Trả về mã lỗi tổng quát nếu xảy ra lỗi trong quá trình đăng nhập
    }
  }

  /**
   * Tìm kiếm các vai trò trong cơ sở dữ liệu dựa trên tên vai trò.
   *
   * @param roleName Tên của vai trò cần tìm kiếm.
   * @returns Mảng các vai trò được tìm thấy.
   */
  async findRole(roleName?: string): Promise<Role[]> {
    const query: Prisma.RoleFindManyArgs = {};

    if (roleName) {
      query.where = { name: roleName }; // Khởi tạo query.where và gán giá trị cho nó
    }

    return await this.databaseService.role.findMany(query);
  }

  /**
   * Tạo mã JWT cho người dùng.
   *
   * @param userId ID của người dùng.
   * @param email Email của người dùng.
   * @param name Tên của người dùng.
   * @param withRefreshToken Flag chỉ định xem có tạo refresh token hay không. Mặc định là true.
   * @returns Đối tượng chứa access token, refresh token và thời gian hết hạn.
   */
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
        expiresIn: '30m', // Thời gian hết hạn
        secret: this.configService.get('CONFIG_JWT_SECRET'),
      }),
      expires_in: futureTimestamp.toString(),
    };

    if (withRefreshToken) {
      result.refresh_token = await this.jwtService.signAsync(payload, {
        expiresIn: '7d', // Thời gian hết hạn
        secret: this.configService.get('CONFIG_JWT_REFRESH_TOKEN'),
      });
    }

    return result;
  }

  /**
   * Gửi mã xác nhận đến địa chỉ email đã cho.
   *
   * @param email Địa chỉ email của người dùng.
   * @param name Tên của người dùng.
   * @returns true nếu gửi mã thành công, ngược lại trả về false.
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

  /**
   * Xác nhận email của người dùng bằng mã xác nhận.
   *
   * @param email Địa chỉ email của người dùng.
   * @param code Mã xác nhận gửi đến email.
   * @returns true nếu xác nhận thành công, false nếu mã không hợp lệ hoặc đã hết hạn.
   */
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

        return false;
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
      return false;
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

  /**
   * Thay đổi mật khẩu của người dùng.
   *
   * @param email Địa chỉ email của người dùng.
   * @param oldPassword Mật khẩu cũ của người dùng.
   * @param password Mật khẩu mới của người dùng.
   * @returns true nếu thay đổi mật khẩu thành công, ngược lại trả về false.
   */
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

      // Kiểm tra xem mật khẩu cũ có đúng không
      const oldPasswordBcrypt: string = String(
        await Password.bcryptPassword(
          await HandleBase64.decodePasswordBase64(oldPassword),
        ),
      );

      if (oldPasswordBcrypt !== existingUser.password) {
        // Ghi log nếu mật khẩu cũ không đúng
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

      // Mã hoá mật khẩu mới và cập nhật vào cơ sở dữ liệu
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

      // Ghi log khi thay đổi mật khẩu thành công
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
      // Ghi log khi xảy ra lỗi trong quá trình thay đổi mật khẩu
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

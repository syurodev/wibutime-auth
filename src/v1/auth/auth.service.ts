import { Injectable, Logger } from '@nestjs/common';
import { Profile } from 'passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import * as moment from 'moment';

import { ParseGoogleProfile } from 'src/utils/utils.parse.common/utils.parse.google.profile.common';
import { UserService } from '../user/user.service';
import { Password } from 'src/utils/utils.password.common/utils.password.common';
import { AccountProviderEnum } from 'src/utils/utils.enums/account-provider.enum';
import { HandleBase64 } from 'src/utils/utils.handle-base64.common/utils.handle-base64.common';
import { UserRoleEnum } from 'src/utils/utils.enums/user-roles.enums';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { GenerateCode } from 'src/utils/utils.generate.common/utils.generate-code.common';
import { FullTokenResponse, UserRegisterRequest } from 'src/proto/auth/auth';

@Injectable()
export class AuthService {
  constructor(
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
        try {
          await this.sendVerificationEmail(createdUser.email, createdUser.name);
        } catch (error) {
          await this.databaseService.user.delete({
            where: {
              id: createdUser.id,
            },
          });

          return 'Tạo người dùng không thành công';
        }
      }

      return createdUser ? createdUser : 'Tạo người dùng không thành công';
    } catch (error) {
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
        delete existingUser.password;

        if (existingUser) {
          existingUser.backend_token = await this.generateJwt(
            existingUser.id,
            existingUser.email,
            existingUser.name,
          );
        }

        return existingUser;
      } else {
        return 'INCORRECT_PASSWORD';
      }
    } catch (error) {
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

      return true;
    } catch (error) {
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
        return null;
      }

      if (
        code === existingCode.code &&
        existingCode.expires > new Date().getTime()
      ) {
        await this.databaseService.verificationEmailCode.delete({
          where: { email },
        });

        await this.databaseService.user.update({
          where: {
            email: email,
          },
          data: {
            email_verified: true,
          },
        });

        return true;
      }

      return false;
    } catch (error) {
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
      return true;
    } catch (error) {
      Logger.error(error.message);
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

      await this.databaseService.user.update({
        where: { email: email },
        data: {
          password: newPassword,
        },
      });

      return true;
    } catch (error) {
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

        return true;
      }

      return false;
    } catch (error) {
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

      return true;
    } catch (error) {
      Logger.error(error.message);
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

        return true;
      }

      return false;
    } catch (error) {
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

      if (oldPasswordBcrypt !== existingUser.password) return false;

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
      });

      return true;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  }
}

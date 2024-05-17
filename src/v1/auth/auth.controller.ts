import { Controller, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { validate } from 'class-validator';

import { AuthService } from './auth.service';
import { UserCreateDTO } from '../user/user.dto/user-create.dto';
import {
  AuthGRPCServiceController,
  AuthGRPCServiceControllerMethods,
  ChangeNewPasswordRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  FullTokenResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ResetPasswordRequest,
  VerificationChangePasswordRequest,
  VerificationEmailRequest,
  EmptyResponse,
  VerificationForgotPasswordRequest,
  SendVerificationRequest,
  UserRegisterRequest,
  UserRegisterResponse,
  VerificationJwtTokenRequest,
  VerificationJwtTokenResponse,
  GoogleProfile,
} from 'src/proto/auth/auth';
import { VersionEnum } from 'src/common/enums/utils.version.enum';
import { BaseResponseData } from 'src/common/response/base.response.common';
import { Observable } from 'rxjs';
import { AUTH_MESSAGE_RESPONSE } from 'src/common/enums/response/auth-message.enum';

@Controller({
  version: VersionEnum.V1.toString(),
  path: 'auth',
})
@AuthGRPCServiceControllerMethods()
export class AuthController implements AuthGRPCServiceController {
  constructor(private readonly authService: AuthService) {}

  //Đăng nhập bằng tài khoản google
  // @MessagePattern(KafkaTopicEnum.GOOGLE_LOGIN)
  // async handleGoogleLogin(@Payload() userData: string) {
  //   const response = new ResponseData();
  //   const result = await this.authService.googleLogin(userData);

  //   if (!result) {
  //     response.setMessage('Đăng nhập bằng google không thành công!');
  //     return JSON.stringify(response);
  //   }

  //   response.setData(result);
  //   return JSON.stringify(response);
  // }
  async googleLogin(request: GoogleProfile): Promise<EmptyResponse> {
    const response: BaseResponseData = new BaseResponseData();
    return response;
  }

  //Đăng nhập bằng tài khoản mật khẩu
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      const response: BaseResponseData = new BaseResponseData();

      const result: UserResponse | string =
        await this.authService.credentialLogin(
          request.username,
          request.password,
        );

      if (!result) {
        response.setMessage(
          HttpStatus.BAD_REQUEST,
          'Đăng nhập không thành công!',
        );
        return response;
      }

      if (typeof result == 'string') {
        response.setMessage(HttpStatus.BAD_REQUEST, result);
        return response;
      }

      response.setData(result);
      return response;
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  //Tạo tài khoản
  async register(request: UserRegisterRequest): Promise<UserRegisterResponse> {
    const response: BaseResponseData = new BaseResponseData();

    const validationErrors = await validate(
      Object.assign(new UserCreateDTO(), request),
    );

    if (validationErrors.length > 0) {
      response.setMessage(
        HttpStatus.BAD_REQUEST,
        validationErrors[0].constraints[0],
      );
      return response;
    }

    const result = await this.authService.createUser(request);

    if (!result) {
      response.setMessage(
        HttpStatus.BAD_REQUEST,
        'Tạo tài khoản không thành công!',
      );
      return response;
    }

    if (typeof result == 'string') {
      response.setMessage(HttpStatus.BAD_REQUEST, result);
      return response;
    }

    response.setData(result);
    return response;
  }

  //GOOGLE LOGIN REDIRECT
  // @MessagePattern(KafkaTopicEnum.GOOGLE_REDIRECT)
  // async handleGoogleRedirect(@Payload() userData: Prisma.UserCreateInput) {
  //   const response = new ResponseData();
  //   const result = await this.authService.createUser(userData);

  //   if (!result) {
  //     response.setMessage('Đăng nhập bằng google không thành công');
  //     return JSON.stringify(response);
  //   }

  //   response.setData(result);
  //   return JSON.stringify(response);
  // }

  //REFRESH JWT TOKEN
  async refreshToken(
    userData: RefreshTokenRequest,
  ): Promise<RefreshTokenResponse> {
    const response: BaseResponseData = new BaseResponseData();
    const result: FullTokenResponse | null = await this.authService.generateJwt(
      userData.id,
      userData.email,
      userData.name,
    );

    if (!result) {
      response.setMessage(
        HttpStatus.BAD_REQUEST,
        'Refresh token không thành công!',
      );
    }

    response.setData(result);

    return response;
  }

  //SEND VERIFICATION EMAIL
  async sendVerification(
    request: SendVerificationRequest,
  ): Promise<EmptyResponse> {
    const response: BaseResponseData = new BaseResponseData();

    const result = await this.authService.sendVerificationEmail(
      request.email,
      request.name,
    );

    if (result) {
      response.setMessage(HttpStatus.OK, 'Gửi mã xác nhận thành công!');
      return response;
    }

    response.setMessage(
      HttpStatus.BAD_REQUEST,
      'Gửi mã xác nhận không thành công!',
    );
    return response;
  }

  async verificationEmail(
    request: VerificationEmailRequest,
  ): Promise<EmptyResponse> {
    const response: BaseResponseData = new BaseResponseData();

    const result = await this.authService.verificationEmail(
      request.email,
      request.code,
    );

    if (result) {
      response.setMessage(HttpStatus.OK, 'Xác thực email thành công!');
      return response;
    }

    response.setMessage(
      HttpStatus.BAD_REQUEST,
      'Xác thực email không thành công!',
    );
    return response;
  }

  // FORGOT PASSWORD
  async forgotPassword(request: ForgotPasswordRequest): Promise<EmptyResponse> {
    const response: BaseResponseData = new BaseResponseData();

    const result: boolean = await this.authService.forgotPassword(
      request.email,
    );

    if (result) {
      response.setMessage(
        HttpStatus.OK,
        'Gửi mã thành công. Vui lòng kiểm tra email của bạn!',
      );
      return response;
    }

    response.setMessage(HttpStatus.BAD_REQUEST, 'Gửi mã không thành công!');
    return response;
  }

  //VERIFI FORGOT PASSWORD
  async verificationForgotPassword(
    request: VerificationForgotPasswordRequest,
  ): Promise<EmptyResponse> {
    const response: BaseResponseData = new BaseResponseData();

    const result: boolean = await this.authService.verificationForgotPassword(
      request.email,
      request.code,
    );

    if (result) {
      response.setMessage(
        HttpStatus.OK,
        'Xác thực mã thành công. Hãy đặt lại mật khẩu của bạn!',
      );
      return response;
    }

    response.setMessage(
      HttpStatus.BAD_REQUEST,
      'Xác thực mã không thành công!',
    );
    return response;
  }

  //RESET PASSWORD
  async resetPassword(request: ResetPasswordRequest): Promise<EmptyResponse> {
    const response: BaseResponseData = new BaseResponseData();

    const result: boolean = await this.authService.resetPassword(
      request.email,
      request.password,
    );

    if (result) {
      response.setMessage(HttpStatus.OK, 'Đặt lại mật khẩu thành công!');
      return response;
    }

    response.setMessage(
      HttpStatus.BAD_REQUEST,
      'Đặt lại mật khẩu không thành công!',
    );
    return response;
  }

  //CHANGE PASSWORD
  async changePassword(request: ChangePasswordRequest): Promise<EmptyResponse> {
    const response: BaseResponseData = new BaseResponseData();

    const result: boolean = await this.authService.changePassword(
      request.email,
    );

    if (result) {
      response.setMessage(HttpStatus.OK, 'Gửi mã xác thực thành công!');
      return response;
    }

    response.setMessage(
      HttpStatus.BAD_REQUEST,
      'Gửi mã xác thực không thành công!',
    );
    return response;
  }

  //VERIFI CHANGE PASSWORD
  async verificationChangePassword(
    request: VerificationChangePasswordRequest,
  ): Promise<EmptyResponse> {
    const response: BaseResponseData = new BaseResponseData();

    const result: boolean = await this.authService.verificationChangePassword(
      request.email,
      request.code,
    );

    if (result) {
      response.setMessage(
        HttpStatus.OK,
        'Xác thực thành công. Hãy đổi mật khẩu của bạn!',
      );
      return response;
    }

    response.setMessage(
      HttpStatus.BAD_REQUEST,
      'Xác thực mã không thành công!',
    );
    return response;
  }

  //CHANGE NEW PASSWORD
  async changeNewPassword(
    request: ChangeNewPasswordRequest,
  ): Promise<EmptyResponse> {
    const response: BaseResponseData = new BaseResponseData();

    const result: boolean = await this.authService.changeNewPassword(
      request.email,
      request.old_password,
      request.password,
    );

    if (result) {
      response.setMessage(HttpStatus.OK, 'Đổi mật khẩu thành công!');
      return response;
    }

    response.setMessage(
      HttpStatus.BAD_REQUEST,
      'Đổi mật khẩu không thành công!',
    );
    return response;
  }

  async verificationJwtToken(
    request: VerificationJwtTokenRequest,
  ): Promise<VerificationJwtTokenResponse> {
    const response: BaseResponseData = new BaseResponseData();

    const result: UserResponse | null =
      await this.authService.verifyAccessToken(request.access_token);

    if (!result) {
      response.setMessage(
        HttpStatus.UNAUTHORIZED,
        AUTH_MESSAGE_RESPONSE.UNAUTHORIZED,
      );
      return response;
    }

    response.setData(result);
    return response;
  }
}

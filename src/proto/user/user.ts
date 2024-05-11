/* eslint-disable */
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';

export const protobufPackage = 'usergrpc';

export interface GetUserDetailRequest {
  slug: string;
  useId: boolean;
  withPassword: boolean;
  withRole: boolean;
  withPermission: boolean;
}

export interface GetUserDetailResponse {
  error: ErrorResponse | undefined;
  success: UserDataResponse | undefined;
}

export interface FullTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserDataResponse {
  id: number;
  name: string;
  email: string;
  email_verified: boolean;
  image: string;
  coins: number;
  provider: string;
  username?: string | undefined;
  password?: string | undefined;
  roles?: string[];
  permissions?: string[];
}

export interface ErrorResponse {
  message: string;
}

export const USER_GRPC_PACKAGE_NAME = 'usergrpc';

export interface userGRPCServiceClient {
  getUserDetail(
    request: GetUserDetailRequest,
  ): Observable<GetUserDetailResponse>;
}

export interface userGRPCServiceController {
  getUserDetail(
    request: GetUserDetailRequest,
  ):
    | Promise<GetUserDetailResponse>
    | Observable<GetUserDetailResponse>
    | GetUserDetailResponse;
}

export function userGRPCServiceControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = ['getUserDetail'];
    for (const method of grpcMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(
        constructor.prototype,
        method,
      );
      GrpcMethod('userGRPCService', method)(
        constructor.prototype[method],
        method,
        descriptor,
      );
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(
        constructor.prototype,
        method,
      );
      GrpcStreamMethod('userGRPCService', method)(
        constructor.prototype[method],
        method,
        descriptor,
      );
    }
  };
}

export const USER_GRPC_SERVICE_NAME = 'userGRPCService';

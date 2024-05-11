import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { KafkaTopicEnum } from 'src/utils/utils.enums/kafka-topic-enum';
import { UserService } from './user.service';
import { ResponseData } from 'src/utils/utils.response.common/utils.response.common';
import {
  GetUserDetailRequest,
  GetUserDetailResponse,
  UserDataResponse,
  userGRPCServiceController,
  userGRPCServiceControllerMethods,
} from 'src/protos/user/user';

@Controller()
@userGRPCServiceControllerMethods()
export class UserController implements userGRPCServiceController {
  constructor(private readonly userService: UserService) {}

  //Tìm kiếm 1 người dùng bằng email hoặc username
  @MessagePattern(KafkaTopicEnum.FIND_USER)
  async handleFindOneUserWithEmailOrUsername(
    @Payload()
    payload: {
      slug: number;
      useId: boolean;
      withPassword: boolean;
      withRole: boolean;
      withPermission: boolean;
    },
  ) {
    const response = new ResponseData();
    const result = await this.userService.findOneUser(
      payload.slug,
      false,
      payload.withPassword,
      payload.withRole,
      payload.withPermission,
    );

    if (!result) {
      response.setMessage('Không tìm thấy người dùng');
      return JSON.stringify(response);
    }

    response.setData(result);
    return JSON.stringify(response);
  }

  //Tìm kiếm 1 người dùng bằng id
  async getUserDetail(
    request: GetUserDetailRequest,
  ): Promise<GetUserDetailResponse> {
    try {
      const response = new ResponseData<UserDataResponse>();

      response.autoGenerateResponse(
        await this.userService.findOneUser(
          request.slug,
          request.useId,
          request.withPassword,
          request.withRole,
          request.withPermission,
        ),
        'Không tìm thấy người dùng',
      );

      return response;
    } catch (error) {
      throw new Error(error.message);
    }
  }
  // @MessagePattern(KafkaTopicEnum.FIND_USER_ID)
  // async handleFindOneUserWithId(
  //   @Payload()
  //   payload: {
  //     slug: number;
  //     useId: boolean;
  //     withPassword: boolean;
  //     withRole: boolean;
  //     withPermission: boolean;
  //   },
  // ) {
  //   const response = new ResponseData();
  //   const existingUser = await this.userService.findOneUser(
  //     payload.slug,
  //     payload.useId,
  //     payload.withPassword,
  //     payload.withRole,
  //     payload.withPermission,
  //   );

  //   if (!existingUser) {
  //     response.setMessage('Không tìm thấy người dùng');
  //     return JSON.stringify(response);
  //   }

  //   response.setData(existingUser);
  //   return JSON.stringify(response);
  // }
}

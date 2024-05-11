import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';

import { DatabaseService } from '../database/database.service';
import { UserDataResponse } from 'src/proto/user/user';

export type UserQuery = User & {
  roles?: [
    {
      name: string;
      permissions?: [
        {
          name: string;
        },
      ];
    },
  ];
};

@Injectable()
export class UserService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * @param slug
   * @param useId true nếu tìm theo id
   * @param withPassword optional
   * @param withRole optional
   * @param withPermission optional
   * @returns UserResponse | null
   */
  async findOneUser(
    slug: string | number,
    useId: boolean,
    withPassword: boolean = false,
    withRole: boolean = false,
    withPermission: boolean = false,
  ): Promise<UserResponse | null> {
    let selectOptions: Prisma.UserSelect = {
      id: true,
      name: true,
      email: true,
      username: true,
      image: true,
      email_verified: true,
      provider: true,
      coins: true,
      password: withPassword,
    };

    if (withRole || withPermission) {
      // Nếu cần lấy role hoặc permission, thì cần thêm include
      selectOptions = {
        ...selectOptions,
        roles: {
          select: {
            name: true,
            ...(withPermission && {
              permissions: {
                select: {
                  name: true,
                },
              },
            }),
          },
        },
      };
    }

    const whereCondition: Prisma.UserWhereInput = useId
      ? { id: Number(slug) } // Chuyển slug thành number nếu sử dụng id
      : {
          OR: [
            { email: slug as string },
            { username: { contains: slug as string } },
          ],
        };

    const existingUser: UserQuery = await this.databaseService.user.findFirst({
      where: whereCondition,
      select: selectOptions,
    } as Prisma.UserFindFirstArgs);

    if (!existingUser) {
      return null;
    }

    const result: UserDataResponse = {
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      username: existingUser.username,
      image: existingUser.image,
      email_verified: existingUser.email_verified,
      coins: existingUser.coins,
      provider: existingUser.provider,
    };

    if (withPassword) {
      result.password = existingUser.password;
    }

    if (withRole) {
      result.roles = existingUser.roles.map((role) => role.name);
    }

    if (withPermission) {
      result.permissions = Array.from(
        new Set(
          existingUser.roles
            .map((role) =>
              role.permissions.map((permission) => permission.name),
            )
            .flat(),
        ),
      ) as string[];
    }

    return result;
  }
}

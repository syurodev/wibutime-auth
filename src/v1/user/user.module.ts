import { Global, Module } from '@nestjs/common';

import { UserService } from './user.service';

@Global()
@Module({
  providers: [UserService],
})
export class UserModule {}

import { IsString, IsEmail } from 'class-validator';

export class ToUserDTO {
  @IsString()
  name: string;

  @IsEmail()
  email: string;
}

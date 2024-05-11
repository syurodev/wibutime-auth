import { IsString, IsEmail, IsOptional } from 'class-validator';

export class UserCreateDTO {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone: string | null;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  username: string | null;

  @IsOptional()
  @IsString()
  password: string | null;

  @IsOptional()
  @IsString()
  image: string | null;

  @IsOptional()
  @IsString()
  image_key: string | null;

  @IsOptional()
  @IsString()
  provider: string | null;
}

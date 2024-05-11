type UserResponse = {
  id: number;
  name: string;
  email: string;
  email_verified: boolean;
  image: string;
  provider: string;
  coins: number;
  username?: string;
  password?: string;
  backend_token?: FullTokenResponse;
  roles?: string[];
  permissions?: string[];
};

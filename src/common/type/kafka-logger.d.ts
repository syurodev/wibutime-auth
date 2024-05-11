type AuthAction =
  | 'LOGIN'
  | 'REGISTER'
  | 'CHANGE_PASSWORD'
  | 'RESET_PASSWORD'
  | 'CHANGE_EMAIL'
  | 'SEND_CODE'
  | 'VERIFICATION_EMAIL';

type KafkaLogger = {
  user_id: number;
  message: string;
  log_date: Date;
  public: boolean;
  result: string;
  type: 'INFO' | 'ERROR';
  actor: 'USER' | 'SYSTEM';
  error_message?: string;
  auth_action?: AuthAction;
};

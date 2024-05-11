export enum KafkaTopicEnum {
  FIND_USER = 'kafka.topic.user.find',
  FIND_USER_ID = 'kafka.topic.user.findid',

  CREATE_CREDENTIAL_USER = 'kafka.topic.credential.user.create',
  CREDENTIAL_LOGIN = 'kafka.topic.credential.login',

  GOOGLE_LOGIN = 'kafka.topic.google.login',
  GOOGLE_REDIRECT = 'kafka.topic.google.redirect',
}

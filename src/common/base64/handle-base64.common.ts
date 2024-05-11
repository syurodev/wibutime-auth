import { HttpException, HttpStatus } from '@nestjs/common';
import { ExceptionResponseDetail } from '../exception/exception.common';

export class HandleBase64 {
  private api_key: string;
  private password: string;

  constructor(api_key?: string, password?: string) {
    this.api_key = api_key;
    this.password = password;
  }

  static generateApiKey(api_key: string): string {
    if (!api_key) {
      throw new HttpException(
        new ExceptionResponseDetail(
          HttpStatus.FORBIDDEN,
          'api_key không hợp lệ!',
        ),
        HttpStatus.OK,
      );
    } else {
      const buff = Buffer.from(api_key);
      const base64data = buff.toString('base64');
      return base64data + '&sd';
    }
  }

  static verifyApiKey(api_key: string): string {
    if (!api_key) {
      throw new HttpException(
        new ExceptionResponseDetail(
          HttpStatus.FORBIDDEN,
          'api_key không hợp lệ!',
        ),
        HttpStatus.OK,
      );
    } else {
      const splitAPIKey = api_key.split(' ');
      if (splitAPIKey[0] !== 'Basic') {
        throw new HttpException(
          new ExceptionResponseDetail(
            HttpStatus.FORBIDDEN,
            'api_key không hợp lệ!',
          ),
          HttpStatus.OK,
        );
      } else {
        const response = splitAPIKey[1].split('&sd');
        const buff = Buffer.from(response[0], 'base64');
        const text = buff.toString('ascii');
        return text;
      }
    }
  }

  static splitRefeshToken(api_key: string): string {
    const splitAPIKey = api_key.split(' ');
    return splitAPIKey[0];
  }

  /**
   *
   * @param password password đưuọc truyền dưới dạng base64
   * @returns
   */
  static async decodePasswordBase64(password: string): Promise<string> {
    if (!password) {
      throw new HttpException(
        new ExceptionResponseDetail(
          HttpStatus.BAD_REQUEST,
          'password không được rỗng!',
        ),
        HttpStatus.OK,
      );
    } else {
      const buff = Buffer.from(password, 'base64');
      const text: string = buff.toString('ascii');
      return text;
    }
  }

  /**
   *
   * @param api_key client sẽ gửi đoạn mã base64 sau đó API sẽ decode lại thành chuỗi bình thường
   * @returns
   */

  static decodeSecretKey(api_key: string): string {
    if (!api_key) {
      throw new HttpException(
        new ExceptionResponseDetail(
          HttpStatus.BAD_REQUEST,
          'api_key không hợp lệ!',
        ),
        HttpStatus.OK,
      );
    } else {
      const buff = Buffer.from(api_key, 'base64');
      const text = buff.toString('ascii');
      return text;
    }
  }

  public getApi_key(): string {
    return this.api_key;
  }

  public setApi_key(api_key: string): void {
    this.api_key = api_key;
  }

  public getPassword(): string {
    return this.password;
  }

  public setPassword(password: string): void {
    this.password = password;
  }
}

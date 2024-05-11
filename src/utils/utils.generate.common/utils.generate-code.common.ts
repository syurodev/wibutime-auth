export class GenerateCode {
  private code: number;

  constructor(code: number) {
    this.code = code;
  }

  static generateRandomSixDigitNumber(): number {
    const min = 100000;
    const max = 999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

export class BaseListResponseData<T> {
  private list: T[];
  private limit: number;
  private total_record: number;

  constructor(list?: any, limit?: number, total_record?: number) {
    this.list = list ? list : [];
    this.limit = limit ? +limit : 0;
    this.total_record = total_record ? +total_record : 0;
  }
  // eslint-disable-next-line @typescript-eslint/ban-types
  public getData(): Object {
    return this.list;
  }

  public setData(list: T[]): void {
    this.list = list;
  }
}

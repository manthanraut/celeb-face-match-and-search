export interface FileStorage {
  delete(key: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  write(key: string, contents: Buffer | string): Promise<void>;
}

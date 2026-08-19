import type { Readable } from "node:stream";

export type StoredImageExtension = "jpg" | "png";

export interface OpenedStoredImage {
  sizeBytes: number;
  stream: Readable;
}

export interface ImageStorage {
  delete(key: string): Promise<void>;
  initialize(): Promise<void>;
  open(key: string): Promise<OpenedStoredImage>;
  write(data: Buffer, extension: StoredImageExtension): Promise<string>;
}

export class StoredImageNotFoundError extends Error {
  constructor(options?: ErrorOptions) {
    super("The stored image does not exist.", options);
    this.name = "StoredImageNotFoundError";
  }
}

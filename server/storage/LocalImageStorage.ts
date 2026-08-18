import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";

import {
  type ImageStorage,
  type OpenedStoredImage,
  StoredImageNotFoundError,
  type StoredImageExtension,
} from "./ImageStorage.js";

const STORAGE_KEY_PATTERN = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(?:jpg|png)$/;

export class LocalImageStorage implements ImageStorage {
  readonly #rootDirectory: string;

  constructor(rootDirectory: string) {
    this.#rootDirectory = path.resolve(rootDirectory);
  }

  async initialize(): Promise<void> {
    await mkdir(this.#rootDirectory, { mode: 0o700, recursive: true });
  }

  async write(data: Buffer, extension: StoredImageExtension): Promise<string> {
    await this.initialize();

    const identifier = randomUUID();
    const key = `${identifier}.${extension}`;
    const destinationPath = this.#resolveStorageKey(key);
    const temporaryPath = path.join(this.#rootDirectory, `.${identifier}.tmp`);

    try {
      const temporaryFile = await open(
        temporaryPath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        0o600,
      );
      try {
        await temporaryFile.writeFile(data);
      } finally {
        await temporaryFile.close();
      }

      await rename(temporaryPath, destinationPath);
      return key;
    } catch (error) {
      await unlink(temporaryPath).catch((cleanupError: unknown) => {
        if (!isFileSystemError(cleanupError, "ENOENT")) {
          throw cleanupError;
        }
      });
      throw error;
    }
  }

  async open(key: string): Promise<OpenedStoredImage> {
    const filePath = this.#resolveStorageKey(key);
    let file: Awaited<ReturnType<typeof open>>;

    try {
      file = await open(filePath, constants.O_RDONLY);
    } catch (error) {
      if (isFileSystemError(error, "ENOENT")) {
        throw new StoredImageNotFoundError({ cause: error });
      }
      throw error;
    }

    try {
      const statistics = await file.stat();
      if (!statistics.isFile()) {
        throw new StoredImageNotFoundError();
      }

      return {
        sizeBytes: statistics.size,
        stream: file.createReadStream(),
      };
    } catch (error) {
      await file.close().catch(() => undefined);
      if (error instanceof StoredImageNotFoundError) {
        throw error;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.#resolveStorageKey(key);

    try {
      await unlink(filePath);
    } catch (error) {
      if (!isFileSystemError(error, "ENOENT")) {
        throw error;
      }
    }
  }

  #resolveStorageKey(key: string): string {
    if (!STORAGE_KEY_PATTERN.test(key)) {
      throw new Error("Invalid local image storage key.");
    }

    const resolvedPath = path.resolve(this.#rootDirectory, key);
    if (path.dirname(resolvedPath) !== this.#rootDirectory) {
      throw new Error("Invalid local image storage path.");
    }

    return resolvedPath;
  }
}

function isFileSystemError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FileStorage } from "./FileStorage.js";

export class LocalFileStorage implements FileStorage {
  readonly #rootDirectory: string;

  constructor(rootDirectory: string) {
    this.#rootDirectory = path.resolve(rootDirectory);
  }

  #resolveKey(key: string) {
    const filePath = path.resolve(this.#rootDirectory, key);
    const relativePath = path.relative(this.#rootDirectory, filePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("Storage key must remain inside the data directory.");
    }

    return filePath;
  }

  async delete(key: string) {
    await rm(this.#resolveKey(key), { force: true });
  }

  async read(key: string) {
    return readFile(this.#resolveKey(key));
  }

  async write(key: string, contents: Buffer | string) {
    const filePath = this.#resolveKey(key);
    const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(temporaryPath, contents);
    await rename(temporaryPath, filePath);
  }
}

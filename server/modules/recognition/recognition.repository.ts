import type { FileStorage } from "../../storage/FileStorage.js";

export class RecognitionRepository {
  readonly #storage: FileStorage;

  constructor(storage: FileStorage) {
    this.#storage = storage;
  }

  key(assetId: string) {
    return `recognition-results/${assetId}.json`;
  }

  async get(assetId: string) {
    try {
      const contents = await this.#storage.read(this.key(assetId));
      return JSON.parse(contents.toString("utf8")) as unknown;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async save(assetId: string, response: unknown) {
    await this.#storage.write(this.key(assetId), JSON.stringify(response, null, 2));
    return this.key(assetId);
  }
}

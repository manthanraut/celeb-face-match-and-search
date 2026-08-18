import { photoAssetSchema, type PhotoAsset } from "../../../shared/contracts/assets.js";
import type { FileStorage } from "../../storage/FileStorage.js";

export class AssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Photo asset ${assetId} was not found.`);
    this.name = "AssetNotFoundError";
  }
}

export class AssetsRepository {
  readonly #storage: FileStorage;
  readonly #writeLocks = new Map<string, Promise<void>>();

  constructor(storage: FileStorage) {
    this.#storage = storage;
  }

  #key(assetId: string) {
    return `assets/${assetId}.json`;
  }

  async create(asset: PhotoAsset) {
    const validatedAsset = photoAssetSchema.parse(asset);
    await this.#storage.write(this.#key(asset.id), JSON.stringify(validatedAsset, null, 2));
    return validatedAsset;
  }

  async get(assetId: string) {
    try {
      const contents = await this.#storage.read(this.#key(assetId));
      return photoAssetSchema.parse(JSON.parse(contents.toString("utf8")));
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new AssetNotFoundError(assetId);
      }

      throw error;
    }
  }

  async update(assetId: string, update: (asset: PhotoAsset) => PhotoAsset | Promise<PhotoAsset>) {
    const previousWrite = this.#writeLocks.get(assetId) ?? Promise.resolve();
    let releaseWrite: (() => void) | undefined;
    const currentWrite = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const chainedWrite = previousWrite.then(() => currentWrite);
    this.#writeLocks.set(assetId, chainedWrite);

    await previousWrite;

    try {
      const currentAsset = await this.get(assetId);
      const nextAsset = photoAssetSchema.parse(await update(currentAsset));
      await this.#storage.write(this.#key(assetId), JSON.stringify(nextAsset, null, 2));
      return nextAsset;
    } finally {
      releaseWrite?.();
      if (this.#writeLocks.get(assetId) === chainedWrite) {
        this.#writeLocks.delete(assetId);
      }
    }
  }
}

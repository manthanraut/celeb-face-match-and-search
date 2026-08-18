import {
  type Collection,
  type Db,
  MongoServerError,
  ObjectId,
  type WithId,
} from "mongodb";

import { collectionNames } from "../database/indexes.js";
import {
  type AssetListPage,
  type AssetRecord,
  type AssetRepository,
  DuplicateClientAssetIdError,
  type NewAssetRecord,
} from "./AssetRepository.js";

interface AssetDocument extends NewAssetRecord {
  _id: ObjectId;
}

const objectIdPattern = /^[a-f\d]{24}$/i;

export class MongoAssetRepository implements AssetRepository {
  readonly #assets: Collection<AssetDocument>;

  constructor(database: Db) {
    this.#assets = database.collection<AssetDocument>(collectionNames.assets);
  }

  async findByClientAssetIds(clientAssetIds: string[]): Promise<Map<string, AssetRecord>> {
    if (clientAssetIds.length === 0) {
      return new Map();
    }

    const documents = await this.#assets
      .find({ "ingest.clientAssetId": { $in: [...new Set(clientAssetIds)] } })
      .toArray();

    return new Map(
      documents.map((document) => {
        const asset = toAssetRecord(document);
        return [asset.ingest.clientAssetId, asset];
      }),
    );
  }

  async findById(assetId: string): Promise<AssetRecord | null> {
    const objectId = parseObjectId(assetId);
    if (!objectId) {
      return null;
    }

    const document = await this.#assets.findOne({ _id: objectId });
    return document ? toAssetRecord(document) : null;
  }

  async insert(asset: NewAssetRecord): Promise<AssetRecord> {
    const document: AssetDocument = {
      _id: new ObjectId(),
      ...asset,
    };

    try {
      await this.#assets.insertOne(document);
    } catch (error) {
      if (isDuplicateClientAssetIdError(error)) {
        throw new DuplicateClientAssetIdError({ cause: error });
      }

      throw error;
    }

    return toAssetRecord(document);
  }

  async list({ cursor, limit }: { cursor?: string; limit: number }): Promise<AssetListPage> {
    const cursorFilter = cursor ? await this.#createCursorFilter(cursor) : {};
    if (cursor && !cursorFilter) {
      return { assets: [], hasMore: false };
    }

    const documents = await this.#assets
      .find(cursorFilter ?? {})
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();
    const hasMore = documents.length > limit;

    return {
      assets: documents.slice(0, limit).map(toAssetRecord),
      hasMore,
    };
  }

  async #createCursorFilter(cursor: string) {
    const cursorId = parseObjectId(cursor);
    if (!cursorId) {
      return null;
    }

    const cursorDocument = await this.#assets.findOne(
      { _id: cursorId },
      { projection: { createdAt: 1 } },
    );
    if (!cursorDocument) {
      return null;
    }

    return {
      $or: [
        { createdAt: { $lt: cursorDocument.createdAt } },
        { createdAt: cursorDocument.createdAt, _id: { $lt: cursorId } },
      ],
    };
  }
}

function parseObjectId(value: string): ObjectId | null {
  return objectIdPattern.test(value) ? ObjectId.createFromHexString(value) : null;
}

function toAssetRecord(document: WithId<AssetDocument>): AssetRecord {
  const { _id, ...asset } = document;

  return {
    id: _id.toHexString(),
    ...asset,
  };
}

function isDuplicateClientAssetIdError(error: unknown): boolean {
  if (!(error instanceof MongoServerError) || error.code !== 11_000) {
    return false;
  }

  return (
    error.keyPattern?.["ingest.clientAssetId"] === 1 ||
    error.message.includes("assets_client_asset_id_unique")
  );
}

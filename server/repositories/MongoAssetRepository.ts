import {
  type Collection,
  type Db,
  MongoServerError,
  ObjectId,
  type WithId,
} from "mongodb";

import type { RecognitionProviderName } from "../../shared/contracts/recognition.js";
import { collectionNames } from "../database/indexes.js";
import {
  type AssetRecognitionRetryResult,
  type AssetListPage,
  type AssetRecord,
  type AssetRepository,
  DuplicateClientAssetIdError,
  type NewAssetRecord,
} from "./AssetRepository.js";
import type {
  ApplyAssetEnrichmentInput,
  EnrichmentRepository,
  SaveAssetMetadataInput,
} from "./EnrichmentRepository.js";
import type { GalleryAssetRepository } from "./GalleryAssetRepository.js";
import type {
  ClaimRecognitionJobOptions,
  RecognitionJob,
  RecognitionJobFailure,
  RecognitionJobRepository,
  RecognitionLeaseRecoveryResult,
} from "./RecognitionJobRepository.js";

interface AssetDocument extends NewAssetRecord {
  _id: ObjectId;
}

const objectIdPattern = /^[a-f\d]{24}$/i;

export class MongoAssetRepository
  implements AssetRepository, EnrichmentRepository, GalleryAssetRepository, RecognitionJobRepository
{
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

  async findExistingAssetIds(assetIds: readonly string[]): Promise<Set<string>> {
    if (assetIds.length === 0) {
      return new Set();
    }

    const objectIds = assetIds.map((assetId) => ObjectId.createFromHexString(assetId));
    const documents = await this.#assets
      .find({ _id: { $in: objectIds } }, { projection: { _id: 1 } })
      .toArray();

    return new Set(documents.map((document) => document._id.toHexString()));
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

  async retryRecognition(
    assetId: string,
    now: Date,
    providerName: RecognitionProviderName,
  ): Promise<AssetRecognitionRetryResult> {
    const objectId = parseObjectId(assetId);
    if (!objectId) {
      return { outcome: "NOT_FOUND" };
    }

    const requeued = await this.#assets.findOneAndUpdate(
      {
        _id: objectId,
        "recognition.status": { $in: ["FAILED", "INDETERMINATE"] },
      },
      {
        $inc: { "recognition.revision": 1 },
        $set: {
          "enrichment.associations": [],
          "enrichment.searchReady": false,
          "recognition.attemptNumber": 0,
          "recognition.availableAt": now,
          "recognition.provider": providerName,
          "recognition.queuedAt": now,
          "recognition.status": "QUEUED",
          updatedAt: now,
        },
        $unset: {
          "enrichment.decisionEngineVersion": "",
          "enrichment.evaluatedAt": "",
          "enrichment.recognitionRevision": "",
          "enrichment.sourceTextRevision": "",
          "recognition.completedAt": "",
          "recognition.lastError": "",
          "recognition.lease": "",
          "recognition.normalizedResult": "",
          "recognition.rawResult": "",
          "recognition.startedAt": "",
        },
      },
      { returnDocument: "after" },
    );

    if (requeued) {
      return { outcome: "REQUEUED" };
    }

    const existing = await this.#assets.findOne(
      { _id: objectId },
      { projection: { "recognition.status": 1 } },
    );
    if (!existing) {
      return { outcome: "NOT_FOUND" };
    }

    return { outcome: "NOT_RETRYABLE", status: existing.recognition.status };
  }

  async claimRecognitionJob({
    leaseDurationMs,
    leaseToken,
    maxAttempts,
    now,
    providerName,
    workerId,
  }: ClaimRecognitionJobOptions): Promise<RecognitionJob | null> {
    const claimed = await this.#assets.findOneAndUpdate(
      {
        "recognition.attemptNumber": { $lt: maxAttempts },
        "recognition.availableAt": { $lte: now },
        "recognition.provider": providerName,
        "recognition.status": "QUEUED",
      },
      {
        $inc: { "recognition.attemptNumber": 1 },
        $set: {
          "recognition.lease": {
            claimedAt: now,
            expiresAt: new Date(now.getTime() + leaseDurationMs),
            ownerId: workerId,
            token: leaseToken,
          },
          "recognition.startedAt": now,
          "recognition.status": "PROCESSING",
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
        sort: { "recognition.availableAt": 1, _id: 1 },
      },
    );

    if (!claimed) {
      return null;
    }

    return {
      assetId: claimed._id.toHexString(),
      attemptNumber: claimed.recognition.attemptNumber,
      expectedSizeBytes: claimed.storage.sizeBytes,
      leaseToken,
      mimeType: claimed.storage.mimeType,
      recognitionRevision: claimed.recognition.revision,
      storageKey: claimed.storage.key,
    };
  }

  async completeRecognitionJob(
    job: RecognitionJob,
    { normalizedResult, rawResult }: Parameters<RecognitionJobRepository["completeRecognitionJob"]>[1],
    now: Date,
  ): Promise<boolean> {
    const result = await this.#assets.updateOne(
      recognitionOwnershipFilter(job),
      {
        $inc: { "recognition.revision": 1 },
        $set: {
          "recognition.completedAt": now,
          "recognition.normalizedResult": normalizedResult,
          "recognition.rawResult": rawResult,
          "recognition.status": "SUCCEEDED",
          updatedAt: now,
        },
        $unset: {
          "recognition.lastError": "",
          "recognition.lease": "",
        },
      },
    );

    return result.modifiedCount === 1;
  }

  async applyEnrichment({
    assetId,
    enrichment,
    expectedRecognitionRevision,
    expectedRecognitionStatus,
    expectedSourceTextRevision,
    updatedAt,
  }: ApplyAssetEnrichmentInput): Promise<boolean> {
    const objectId = parseObjectId(assetId);
    if (!objectId) {
      return false;
    }

    const result = await this.#assets.updateOne(
      {
        _id: objectId,
        "recognition.revision": expectedRecognitionRevision,
        "recognition.status": expectedRecognitionStatus,
        "sourceText.revision": expectedSourceTextRevision,
      },
      { $set: { enrichment, updatedAt } },
    );
    return result.modifiedCount === 1;
  }

  async findPendingEnrichmentAsset(decisionEngineVersion: number): Promise<AssetRecord | null> {
    const document = await this.#assets.findOne(
      {
        "recognition.status": "SUCCEEDED",
        $or: [
          { "enrichment.decisionEngineVersion": { $ne: decisionEngineVersion } },
          { $expr: { $ne: ["$enrichment.recognitionRevision", "$recognition.revision"] } },
          { $expr: { $ne: ["$enrichment.sourceTextRevision", "$sourceText.revision"] } },
        ],
      },
      { sort: { "recognition.completedAt": 1, _id: 1 } },
    );
    return document ? toAssetRecord(document) : null;
  }

  async saveMetadataAndEnrichment({
    assetId,
    enrichment,
    expectedRecognitionRevision,
    expectedRecognitionStatus,
    expectedSourceTextRevision,
    sourceText,
    updatedAt,
  }: SaveAssetMetadataInput): Promise<AssetRecord | null> {
    const objectId = parseObjectId(assetId);
    if (!objectId) {
      return null;
    }

    const document = await this.#assets.findOneAndUpdate(
      {
        _id: objectId,
        "recognition.revision": expectedRecognitionRevision,
        "recognition.status": expectedRecognitionStatus,
        "sourceText.revision": expectedSourceTextRevision,
      },
      { $set: { enrichment, sourceText, updatedAt } },
      { returnDocument: "after" },
    );
    return document ? toAssetRecord(document) : null;
  }

  async failRecognitionJob(
    job: RecognitionJob,
    failure: RecognitionJobFailure,
    now: Date,
  ): Promise<boolean> {
    const terminal = failure.status !== "QUEUED";
    const result = await this.#assets.updateOne(
      recognitionOwnershipFilter(job),
      {
        $set: {
          ...(terminal
            ? { "recognition.completedAt": now }
            : { "recognition.availableAt": failure.availableAt ?? now }),
          "recognition.lastError": {
            ...failure.error,
            recordedAt: now,
          },
          "recognition.status": failure.status,
          updatedAt: now,
        },
        $unset: { "recognition.lease": "" },
      },
    );

    return result.modifiedCount === 1;
  }

  async recoverExpiredRecognitionJobs(
    now: Date,
    maxAttempts: number,
  ): Promise<RecognitionLeaseRecoveryResult> {
    const [requeued, indeterminate] = await Promise.all([
      this.#assets.updateMany(
        {
          "recognition.attemptNumber": { $lt: maxAttempts },
          "recognition.lease.expiresAt": { $lte: now },
          "recognition.status": "PROCESSING",
        },
        {
          $set: {
            "recognition.availableAt": now,
            "recognition.lastError": {
              code: "RECOGNITION_LEASE_EXPIRED",
              message: "Recognition was interrupted and will be retried.",
              recordedAt: now,
              retryable: true,
            },
            "recognition.status": "QUEUED",
            updatedAt: now,
          },
          $unset: { "recognition.lease": "" },
        },
      ),
      this.#assets.updateMany(
        {
          "recognition.attemptNumber": { $gte: maxAttempts },
          "recognition.lease.expiresAt": { $lte: now },
          "recognition.status": "PROCESSING",
        },
        {
          $set: {
            "recognition.completedAt": now,
            "recognition.lastError": {
              code: "RECOGNITION_LEASE_EXHAUSTED",
              message: "Recognition was interrupted after the final automatic attempt.",
              recordedAt: now,
              retryable: false,
            },
            "recognition.status": "INDETERMINATE",
            updatedAt: now,
          },
          $unset: { "recognition.lease": "" },
        },
      ),
    ]);

    return {
      indeterminateCount: indeterminate.modifiedCount,
      requeuedCount: requeued.modifiedCount,
    };
  }

  async releaseRecognitionJob(job: RecognitionJob, now: Date): Promise<boolean> {
    const result = await this.#assets.updateOne(
      recognitionOwnershipFilter(job),
      {
        $inc: { "recognition.attemptNumber": -1 },
        $set: {
          "recognition.availableAt": now,
          "recognition.status": "QUEUED",
          updatedAt: now,
        },
        $unset: {
          "recognition.lease": "",
          "recognition.startedAt": "",
        },
      },
    );

    return result.modifiedCount === 1;
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

function recognitionOwnershipFilter(job: RecognitionJob) {
  return {
    _id: ObjectId.createFromHexString(job.assetId),
    "recognition.lease.token": job.leaseToken,
    "recognition.revision": job.recognitionRevision,
    "recognition.status": "PROCESSING" as const,
  };
}

function parseObjectId(value: string): ObjectId | null {
  return objectIdPattern.test(value) ? ObjectId.createFromHexString(value) : null;
}

function toAssetRecord(document: WithId<AssetDocument>): AssetRecord {
  const { _id, ...asset } = document;

  return {
    id: _id.toHexString(),
    ...asset,
    sourceText: {
      ...asset.sourceText,
      backstory: asset.sourceText.backstory ?? null,
    },
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

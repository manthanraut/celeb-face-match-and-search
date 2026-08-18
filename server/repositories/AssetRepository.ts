import type { AssetImageMimeType, AssetRecognitionStatus } from "../../shared/assets.js";
import type {
  RecognitionProviderName,
  RecognitionResult,
} from "../../shared/contracts/recognition.js";

export interface AssetCelebrityAssociation {
  confidence: number | null;
  decision: "APPROVED" | "NEEDS_REVIEW";
  displayName: string;
  evidenceFields: Array<"title" | "caption">;
  identityKey: string;
  providerPersonId: string | null;
  source: "recognition" | "metadata-inference";
}

export interface AssetRecord {
  id: string;
  ingest: {
    clientAssetId: string;
    originalFilename: string;
  };
  storage: {
    checksumSha256: string;
    key: string;
    mimeType: AssetImageMimeType;
    provider: "local";
    sizeBytes: number;
  };
  sourceText: {
    altText: string | null;
    caption: string | null;
    revision: number;
    title: string | null;
    updatedAt: Date;
  };
  recognition: {
    attemptNumber: number;
    availableAt: Date;
    provider: RecognitionProviderName;
    queuedAt: Date;
    revision: number;
    status: AssetRecognitionStatus;
    completedAt?: Date;
    lastError?: {
      code: string;
      message: string;
      retryable: boolean;
      recordedAt: Date;
    };
    lease?: {
      claimedAt: Date;
      expiresAt: Date;
      ownerId: string;
      token: string;
    };
    normalizedResult?: RecognitionResult;
    rawResult?: unknown;
    startedAt?: Date;
  };
  enrichment: {
    associations: AssetCelebrityAssociation[];
    searchReady: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type NewAssetRecord = Omit<AssetRecord, "id">;

export interface AssetListPage {
  assets: AssetRecord[];
  hasMore: boolean;
}

export interface AssetRepository {
  findByClientAssetIds(clientAssetIds: string[]): Promise<Map<string, AssetRecord>>;
  findById(assetId: string): Promise<AssetRecord | null>;
  insert(asset: NewAssetRecord): Promise<AssetRecord>;
  list(options: { cursor?: string; limit: number }): Promise<AssetListPage>;
  retryRecognition(
    assetId: string,
    now: Date,
    providerName: RecognitionProviderName,
  ): Promise<AssetRecognitionRetryResult>;
}

export type AssetRecognitionRetryResult =
  | { outcome: "REQUEUED" }
  | { outcome: "NOT_FOUND" }
  | { outcome: "NOT_RETRYABLE"; status: AssetRecognitionStatus };

export class DuplicateClientAssetIdError extends Error {
  constructor(options?: ErrorOptions) {
    super("The client asset ID already exists.", options);
    this.name = "DuplicateClientAssetIdError";
  }
}

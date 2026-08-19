import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import {
  MAX_ASSET_IMAGE_DIMENSION,
  MAX_ASSET_IMAGE_PIXELS,
  MAX_ASSET_UPLOAD_FILES,
  MAX_ASSET_UPLOAD_FILE_SIZE_BYTES,
  clientAssetIdSchema,
  type Asset,
  type AssetDetail,
  type AssetImageMimeType,
  type AssetListResponse,
  type AssetMetadataUpdate,
  type AssetRecognitionRetryResponse,
  type AssetUploadResult,
} from "../../shared/assets.js";
import type { RecognitionProviderName } from "../../shared/contracts/recognition.js";
import { ApiError } from "../middleware/error-handler.js";
import type { EnrichmentService } from "../modules/enrichment/EnrichmentService.js";
import {
  type AssetRecord,
  type AssetRepository,
  type NewAssetRecord,
} from "../repositories/AssetRepository.js";
import type {
  ImageStorage,
  OpenedStoredImage,
  StoredImageExtension,
} from "../storage/ImageStorage.js";

export interface PreparedAssetUpload {
  clientAssetId: string;
  originalFilename: string;
  buffer: Buffer;
}

export interface AssetIngestResult {
  assets: AssetUploadResult[];
  createdAny: boolean;
}

export interface AssetListOptions {
  cursor?: string;
  limit: number;
}

export interface OpenedAssetImage {
  etag: string;
  mimeType: AssetImageMimeType;
  sizeBytes: number;
  stream: Readable;
}

export interface AssetServiceDependencies {
  enrichmentService: Pick<EnrichmentService, "updateMetadata">;
  repository: AssetRepository;
  storage: ImageStorage;
  clock?: () => Date;
  recognitionProviderName?: RecognitionProviderName;
}

interface PreparedAsset {
  buffer: Buffer;
  checksumSha256: string;
  clientAssetId: string;
  extension: StoredImageExtension;
  mimeType: AssetImageMimeType;
  originalFilename: string;
  title: string;
}

const MAX_DISPLAY_FILENAME_LENGTH = 255;
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let checksum = value;
  for (let bit = 0; bit < 8; bit += 1) {
    checksum = (checksum & 1) === 1 ? 0xedb88320 ^ (checksum >>> 1) : checksum >>> 1;
  }
  return checksum >>> 0;
});
const SHA_256_PATTERN = /^[a-f\d]{64}$/i;

function invalidUpload(message: string): ApiError {
  return new ApiError(400, "INVALID_ASSET_UPLOAD", message);
}

function clientAssetIdConflict(): ApiError {
  return new ApiError(
    409,
    "CLIENT_ASSET_ID_CONFLICT",
    "The client asset ID is already associated with a different image.",
  );
}

function imageUnavailable(): ApiError {
  return new ApiError(500, "ASSET_IMAGE_UNAVAILABLE", "The asset image is unavailable.");
}

function hasSafeImageDimensions(width: number, height: number): boolean {
  return (
    width > 0 &&
    height > 0 &&
    width <= MAX_ASSET_IMAGE_DIMENSION &&
    height <= MAX_ASSET_IMAGE_DIMENSION &&
    width <= Math.floor(MAX_ASSET_IMAGE_PIXELS / height)
  );
}

function hasValidPngChunkChecksum(buffer: Buffer, typeOffset: number, dataLength: number): boolean {
  const checksumOffset = typeOffset + 4 + dataLength;
  let checksum = 0xffffffff;

  for (let offset = typeOffset; offset < checksumOffset; offset += 1) {
    const tableIndex = (checksum ^ buffer[offset]) & 0xff;
    checksum = PNG_CRC_TABLE[tableIndex] ^ (checksum >>> 8);
  }

  return (checksum ^ 0xffffffff) >>> 0 === buffer.readUInt32BE(checksumOffset);
}

function hasValidPngHeader(buffer: Buffer, dataOffset: number): boolean {
  const width = buffer.readUInt32BE(dataOffset);
  const height = buffer.readUInt32BE(dataOffset + 4);
  const bitDepth = buffer[dataOffset + 8];
  const colorType = buffer[dataOffset + 9];
  const compressionMethod = buffer[dataOffset + 10];
  const filterMethod = buffer[dataOffset + 11];
  const interlaceMethod = buffer[dataOffset + 12];
  const validBitDepthsByColorType: Readonly<Record<number, readonly number[]>> = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  };

  return (
    hasSafeImageDimensions(width, height) &&
    bitDepth !== undefined &&
    colorType !== undefined &&
    validBitDepthsByColorType[colorType]?.includes(bitDepth) === true &&
    compressionMethod === 0 &&
    filterMethod === 0 &&
    (interlaceMethod === 0 || interlaceMethod === 1)
  );
}

function hasValidPngStructure(buffer: Buffer): boolean {
  if (
    buffer.length < PNG_SIGNATURE.length ||
    !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return false;
  }

  let offset = PNG_SIGNATURE.length;
  let chunkIndex = 0;
  let hasImageData = false;

  while (offset < buffer.length) {
    // A chunk has a four-byte length, four-byte type, data, and four-byte CRC.
    if (offset > buffer.length - 12) {
      return false;
    }

    const dataLength = buffer.readUInt32BE(offset);
    if (dataLength > buffer.length - offset - 12) {
      return false;
    }

    const typeOffset = offset + 4;
    const dataOffset = offset + 8;
    const chunkEnd = dataOffset + dataLength + 4;
    const type = buffer.toString("ascii", typeOffset, dataOffset);

    if (
      !/^[A-Za-z]{4}$/u.test(type) ||
      !hasValidPngChunkChecksum(buffer, typeOffset, dataLength)
    ) {
      return false;
    }

    if (chunkIndex === 0) {
      if (type !== "IHDR" || dataLength !== 13 || !hasValidPngHeader(buffer, dataOffset)) {
        return false;
      }
    } else if (type === "IHDR") {
      return false;
    }

    if (type === "IDAT" && dataLength > 0) {
      hasImageData = true;
    }

    if (type === "IEND") {
      return dataLength === 0 && hasImageData && chunkEnd === buffer.length;
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  return false;
}

function hasValidJpegStructure(buffer: Buffer): boolean {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return false;
  }

  let offset = 2;
  let hasStartOfFrame = false;
  let hasStartOfScan = false;
  let insideScan = false;
  let currentScanHasData = false;

  while (offset < buffer.length) {
    if (insideScan && buffer[offset] !== 0xff) {
      currentScanHasData = true;
      offset += 1;
      continue;
    }

    if (buffer[offset] !== 0xff) {
      return false;
    }

    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buffer.length) {
      return false;
    }

    const marker = buffer[offset];
    offset += 1;

    if (insideScan) {
      if (marker === 0x00) {
        currentScanHasData = true;
        continue;
      }

      if (marker !== undefined && marker >= 0xd0 && marker <= 0xd7) {
        continue;
      }

      if (!currentScanHasData) {
        return false;
      }
      insideScan = false;
    }

    if (marker === 0xd9) {
      return hasStartOfFrame && hasStartOfScan && offset === buffer.length;
    }

    if (marker === 0x01) {
      continue;
    }

    if (
      marker === undefined ||
      marker === 0x00 ||
      marker === 0xd8 ||
      (marker >= 0xd0 && marker <= 0xd7) ||
      offset > buffer.length - 2
    ) {
      return false;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || segmentLength > buffer.length - offset) {
      return false;
    }

    const segmentEnd = offset + segmentLength;

    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8) {
        return false;
      }

      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      const componentCount = buffer[offset + 7];
      if (
        !hasSafeImageDimensions(width, height) ||
        componentCount === undefined ||
        componentCount === 0 ||
        componentCount > 4 ||
        segmentLength !== 8 + 3 * componentCount
      ) {
        return false;
      }
      hasStartOfFrame = true;
    }

    if (marker === 0xda) {
      const componentCount = buffer[offset + 2];
      if (
        !hasStartOfFrame ||
        segmentLength < 6 ||
        componentCount === undefined ||
        componentCount === 0 ||
        segmentLength !== 6 + 2 * componentCount
      ) {
        return false;
      }

      hasStartOfScan = true;
      insideScan = true;
      currentScanHasData = false;
    }

    offset = segmentEnd;
  }

  return false;
}

function identifyImage(buffer: Buffer): {
  extension: StoredImageExtension;
  mimeType: AssetImageMimeType;
} | null {
  if (hasValidPngStructure(buffer)) {
    return { extension: "png", mimeType: "image/png" };
  }

  if (hasValidJpegStructure(buffer)) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }

  return null;
}

function sanitizeFilename(filename: string, extension: StoredImageExtension): string {
  const normalizedSeparators = filename.replaceAll("\\", "/");
  const basename = normalizedSeparators.slice(normalizedSeparators.lastIndexOf("/") + 1);
  const sanitized = basename
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

  if (sanitized === "" || sanitized === "." || sanitized === "..") {
    return `image.${extension}`;
  }

  const characters = Array.from(sanitized);
  if (characters.length <= MAX_DISPLAY_FILENAME_LENGTH) {
    return sanitized;
  }

  const extensionIndex = sanitized.lastIndexOf(".");
  const filenameExtension = extensionIndex > 0 ? sanitized.slice(extensionIndex) : "";
  const extensionCharacters = Array.from(filenameExtension);
  const preservedExtension = extensionCharacters.length <= 16 ? filenameExtension : "";
  const name = preservedExtension === "" ? sanitized : sanitized.slice(0, extensionIndex);
  const availableNameLength =
    MAX_DISPLAY_FILENAME_LENGTH - (preservedExtension === "" ? 0 : extensionCharacters.length);
  const truncatedName = Array.from(name).slice(0, availableNameLength).join("").trim();

  return `${truncatedName}${preservedExtension}` || `image.${extension}`;
}

function deriveTitle(filename: string): string {
  const title = filename
    .replace(/\.[^.]*$/u, "")
    .replace(/^\s*\d+[\s._-]*/u, "")
    .replace(/[._-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return Array.from(title).slice(0, 500).join("").trim() || "image";
}

function prepareUpload(input: PreparedAssetUpload, index: number): PreparedAsset {
  if (input === null || typeof input !== "object") {
    throw invalidUpload(`Upload ${index + 1} is invalid.`);
  }

  const parsedClientAssetId = clientAssetIdSchema.safeParse(input.clientAssetId);
  if (!parsedClientAssetId.success) {
    throw invalidUpload(`Upload ${index + 1} has an invalid client asset ID.`);
  }

  if (typeof input.originalFilename !== "string") {
    throw invalidUpload(`Upload ${index + 1} has an invalid filename.`);
  }

  if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
    throw invalidUpload(`Upload ${index + 1} does not contain image data.`);
  }

  if (input.buffer.length > MAX_ASSET_UPLOAD_FILE_SIZE_BYTES) {
    throw new ApiError(413, "UPLOAD_FILE_TOO_LARGE", "Each image must be 5 MiB or smaller.");
  }

  const image = identifyImage(input.buffer);
  if (image === null) {
    throw invalidUpload(`Upload ${index + 1} must be a JPEG or PNG image.`);
  }

  const originalFilename = sanitizeFilename(input.originalFilename, image.extension);

  return {
    buffer: input.buffer,
    checksumSha256: createHash("sha256").update(input.buffer).digest("hex"),
    clientAssetId: parsedClientAssetId.data.toLowerCase(),
    extension: image.extension,
    mimeType: image.mimeType,
    originalFilename,
    title: deriveTitle(originalFilename),
  };
}

function createRecord(
  asset: PreparedAsset,
  storageKey: string,
  timestamp: Date,
  recognitionProviderName: RecognitionProviderName,
): NewAssetRecord {
  return {
    ingest: {
      clientAssetId: asset.clientAssetId,
      originalFilename: asset.originalFilename,
    },
    storage: {
      checksumSha256: asset.checksumSha256,
      key: storageKey,
      mimeType: asset.mimeType,
      provider: "local",
      sizeBytes: asset.buffer.length,
    },
    sourceText: {
      altText: null,
      backstory: null,
      caption: null,
      revision: 1,
      title: asset.title,
      updatedAt: timestamp,
    },
    recognition: {
      attemptNumber: 0,
      availableAt: timestamp,
      provider: recognitionProviderName,
      queuedAt: timestamp,
      revision: 1,
      status: "QUEUED",
    },
    enrichment: {
      associations: [],
      searchReady: false,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function toAsset(record: AssetRecord): Asset {
  return {
    assetId: record.id,
    originalFilename: record.ingest.originalFilename,
    mimeType: record.storage.mimeType,
    sizeBytes: record.storage.sizeBytes,
    sourceText: {
      title: record.sourceText.title,
      caption: record.sourceText.caption,
      altText: record.sourceText.altText,
      backstory: record.sourceText.backstory,
      revision: record.sourceText.revision,
    },
    recognitionStatus: record.recognition.status,
    searchReady: record.enrichment.searchReady,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    links: {
      self: `/api/assets/${record.id}`,
      image: `/api/assets/${record.id}/image`,
      admin: `/admin/photos/${record.id}`,
    },
  };
}

function toAssetDetail(record: AssetRecord): AssetDetail {
  return {
    ...toAsset(record),
    enrichment: {
      associations: record.enrichment.associations,
      decisionEngineVersion: record.enrichment.decisionEngineVersion ?? null,
      evaluatedAt: record.enrichment.evaluatedAt?.toISOString() ?? null,
      recognitionRevision: record.enrichment.recognitionRevision ?? null,
      searchReady: record.enrichment.searchReady,
      sourceTextRevision: record.enrichment.sourceTextRevision ?? null,
    },
    recognition: {
      attemptNumber: record.recognition.attemptNumber,
      completedAt: record.recognition.completedAt?.toISOString() ?? null,
      lastError: record.recognition.lastError
        ? {
            code: record.recognition.lastError.code,
            message: record.recognition.lastError.message,
            retryable: record.recognition.lastError.retryable,
            recordedAt: record.recognition.lastError.recordedAt.toISOString(),
          }
        : null,
      provider: record.recognition.provider,
      result: record.recognition.normalizedResult ?? null,
      revision: record.recognition.revision,
      status: record.recognition.status,
    },
  };
}

async function discardStoredImage(storage: ImageStorage, key: string): Promise<void> {
  try {
    await storage.delete(key);
  } catch {
    throw new ApiError(500, "ASSET_INGESTION_FAILED", "The asset could not be stored.");
  }
}

export class AssetService {
  private readonly clock: () => Date;
  private readonly enrichmentService: Pick<EnrichmentService, "updateMetadata">;
  private readonly repository: AssetRepository;
  private readonly recognitionProviderName: RecognitionProviderName;
  private readonly storage: ImageStorage;

  constructor({
    enrichmentService,
    repository,
    storage,
    clock = () => new Date(),
    recognitionProviderName = "aws-rekognition",
  }: AssetServiceDependencies) {
    this.enrichmentService = enrichmentService;
    this.repository = repository;
    this.storage = storage;
    this.clock = clock;
    this.recognitionProviderName = recognitionProviderName;
  }

  async ingest(inputs: readonly PreparedAssetUpload[]): Promise<AssetIngestResult> {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw invalidUpload("At least one image is required.");
    }

    if (inputs.length > MAX_ASSET_UPLOAD_FILES) {
      throw new ApiError(
        400,
        "UPLOAD_FILE_LIMIT_EXCEEDED",
        "Upload no more than 10 images using the images field.",
      );
    }

    // Preparing every input first prevents a late validation failure from leaving
    // files or records behind for otherwise valid items in the same request.
    const preparedAssets = inputs.map((input, index) => prepareUpload(input, index));
    const seenClientAssetIds = new Set<string>();
    for (const asset of preparedAssets) {
      if (seenClientAssetIds.has(asset.clientAssetId)) {
        throw invalidUpload("Each client asset ID must be unique within an upload.");
      }
      seenClientAssetIds.add(asset.clientAssetId);
    }

    const existingByClientAssetId = await this.repository.findByClientAssetIds(
      preparedAssets.map((asset) => asset.clientAssetId),
    );

    // Resolve every known conflict before storing any new item in this batch.
    for (const asset of preparedAssets) {
      const existing = existingByClientAssetId.get(asset.clientAssetId);
      if (existing !== undefined && existing.storage.checksumSha256 !== asset.checksumSha256) {
        throw clientAssetIdConflict();
      }
    }

    const assets: AssetUploadResult[] = [];
    for (const asset of preparedAssets) {
      const existing = existingByClientAssetId.get(asset.clientAssetId);
      if (existing !== undefined) {
        assets.push({ ...toAsset(existing), created: false });
        continue;
      }

      assets.push(await this.ingestOne(asset));
    }

    return {
      assets,
      createdAny: assets.some((asset) => asset.created),
    };
  }

  async getById(assetId: string): Promise<AssetDetail> {
    const record = await this.requireAsset(assetId);
    return toAssetDetail(record);
  }

  async updateMetadata(assetId: string, update: AssetMetadataUpdate): Promise<AssetDetail> {
    return toAssetDetail(await this.enrichmentService.updateMetadata(assetId, update));
  }

  async retryRecognition(assetId: string): Promise<AssetRecognitionRetryResponse> {
    const result = await this.repository.retryRecognition(
      assetId,
      this.clock(),
      this.recognitionProviderName,
    );
    if (result.outcome === "NOT_FOUND") {
      throw new ApiError(404, "ASSET_NOT_FOUND", "The asset was not found.");
    }
    if (result.outcome === "NOT_RETRYABLE") {
      throw new ApiError(
        409,
        "RECOGNITION_RETRY_NOT_ALLOWED",
        "Recognition can be retried only after a failed or indeterminate attempt.",
      );
    }

    return { assetId, recognitionStatus: "QUEUED" };
  }

  async list(options: AssetListOptions): Promise<AssetListResponse> {
    const page = await this.repository.list(options);
    return {
      assets: page.assets.map(toAsset),
      nextCursor: page.hasMore ? (page.assets.at(-1)?.id ?? null) : null,
    };
  }

  async openImage(assetId: string): Promise<OpenedAssetImage> {
    const record = await this.requireAsset(assetId);
    if (!SHA_256_PATTERN.test(record.storage.checksumSha256)) {
      throw imageUnavailable();
    }

    let openedImage: OpenedStoredImage;

    try {
      openedImage = await this.storage.open(record.storage.key);
    } catch {
      throw imageUnavailable();
    }

    if (openedImage.sizeBytes !== record.storage.sizeBytes) {
      openedImage.stream.destroy();
      throw imageUnavailable();
    }

    return {
      etag: `"${record.storage.checksumSha256}"`,
      mimeType: record.storage.mimeType,
      sizeBytes: record.storage.sizeBytes,
      stream: openedImage.stream,
    };
  }

  private async ingestOne(asset: PreparedAsset): Promise<AssetUploadResult> {
    const storageKey = await this.storage.write(asset.buffer, asset.extension);
    let inserted: AssetRecord;

    try {
      inserted = await this.repository.insert(
        createRecord(asset, storageKey, this.clock(), this.recognitionProviderName),
      );
    } catch (error) {
      let existing: AssetRecord | undefined;

      try {
        const matches = await this.repository.findByClientAssetIds([asset.clientAssetId]);
        existing = matches.get(asset.clientAssetId);
      } catch {
        // The insert may have committed before its acknowledgement failed. If
        // reconciliation is unavailable, retaining the file avoids breaking a
        // record that could already reference it.
        throw error;
      }

      if (existing === undefined) {
        // The insert may still commit after this read, so the storage key cannot
        // be treated as an orphan unless another persisted record proves that
        // this attempt lost a client-ID race. Leave it for orphan cleanup and
        // preserve the original repository error.
        throw error;
      }

      if (existing.storage.key === storageKey) {
        if (existing.storage.checksumSha256 !== asset.checksumSha256) {
          // A persisted record references this key, so deleting it would make
          // that record unreadable even though its metadata is inconsistent.
          throw clientAssetIdConflict();
        }

        return { ...toAsset(existing), created: true };
      }

      await discardStoredImage(this.storage, storageKey);

      if (existing.storage.checksumSha256 !== asset.checksumSha256) {
        throw clientAssetIdConflict();
      }

      return { ...toAsset(existing), created: false };
    }

    return { ...toAsset(inserted), created: true };
  }

  private async requireAsset(assetId: string): Promise<AssetRecord> {
    const record = await this.repository.findById(assetId);
    if (record === null) {
      throw new ApiError(404, "ASSET_NOT_FOUND", "The asset was not found.");
    }
    return record;
  }
}

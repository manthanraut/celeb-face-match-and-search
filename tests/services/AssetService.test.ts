import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../server/middleware/error-handler.js";
import {
  DuplicateClientAssetIdError,
  type AssetRecord,
  type AssetRepository,
  type NewAssetRecord,
} from "../../server/repositories/AssetRepository.js";
import { AssetService } from "../../server/services/AssetService.js";
import type { ImageStorage } from "../../server/storage/ImageStorage.js";
import {
  MAX_ASSET_IMAGE_DIMENSION,
  MAX_ASSET_UPLOAD_FILES,
  MAX_ASSET_UPLOAD_FILE_SIZE_BYTES,
} from "../../shared/assets.js";

const FIRST_CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const FIRST_ASSET_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SECOND_ASSET_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const FIXED_TIME = new Date("2027-05-03T12:00:00.000Z");

const JPEG = Buffer.from(
  "/9j/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAJgABAAAAAAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAAPwA//9k=",
  "base64",
);
const OTHER_JPEG = Buffer.from(JPEG);
OTHER_JPEG.writeUInt8(2, 7);
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function jpegWithDimensions(width: number, height: number): Buffer {
  const image = Buffer.from(JPEG);
  const startOfFrameOffset = image.indexOf(Buffer.from([0xff, 0xc0]));
  if (startOfFrameOffset < 0) {
    throw new Error("The JPEG fixture does not contain a start-of-frame marker.");
  }

  image.writeUInt16BE(height, startOfFrameOffset + 5);
  image.writeUInt16BE(width, startOfFrameOffset + 7);
  return image;
}

function pngWithCorruptedImageData(): Buffer {
  const image = Buffer.from(PNG);
  const imageDataOffset = image.indexOf(Buffer.from("IDAT", "ascii")) + 4;
  if (imageDataOffset < 4 || imageDataOffset >= image.length) {
    throw new Error("The PNG fixture does not contain image data.");
  }

  image[imageDataOffset] ^= 1;
  return image;
}

function checksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function makeRecord({
  id = FIRST_ASSET_ID,
  clientAssetId = FIRST_CLIENT_ID,
  image = JPEG,
  key = "stored/first.jpg",
  originalFilename = "first.jpg",
  recognition,
}: {
  id?: string;
  clientAssetId?: string;
  image?: Buffer;
  key?: string;
  originalFilename?: string;
  recognition?: Partial<AssetRecord["recognition"]>;
} = {}): AssetRecord {
  const mimeType = image.subarray(0, 8).equals(PNG.subarray(0, 8)) ? "image/png" : "image/jpeg";

  return {
    id,
    ingest: { clientAssetId, originalFilename },
    storage: {
      checksumSha256: checksum(image),
      key,
      mimeType,
      provider: "local",
      sizeBytes: image.length,
    },
    sourceText: {
      altText: null,
      backstory: null,
      caption: null,
      revision: 1,
      title: "first",
      updatedAt: FIXED_TIME,
    },
    recognition: {
      attemptNumber: 0,
      availableAt: FIXED_TIME,
      provider: "aws-rekognition",
      queuedAt: FIXED_TIME,
      revision: 1,
      status: "QUEUED",
      ...recognition,
    },
    enrichment: { associations: [], hideFromSearch: false },
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  };
}

function createHarness() {
  const enrichmentService = {
    updateMetadata: vi.fn(async () => makeRecord()),
  };
  const repository: AssetRepository = {
    findByClientAssetIds: vi.fn(async () => new Map()),
    findById: vi.fn(async () => null),
    insert: vi.fn(async (asset) => ({ id: FIRST_ASSET_ID, ...asset })),
    list: vi.fn(async () => ({ assets: [], hasMore: false })),
    retryRecognition: vi.fn(async () => ({ outcome: "REQUEUED" as const })),
  };
  const storage: ImageStorage = {
    delete: vi.fn(async () => undefined),
    initialize: vi.fn(async () => undefined),
    open: vi.fn(async () => ({ sizeBytes: JPEG.length, stream: Readable.from(JPEG) })),
    write: vi.fn(async () => "stored/image.jpg"),
  };

  return {
    enrichmentService,
    repository,
    service: new AssetService({
      clock: () => FIXED_TIME,
      enrichmentService,
      repository,
      storage,
    }),
    storage,
  };
}

function expectApiError(error: unknown, statusCode: number, code: string): void {
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ code, statusCode });
}

describe("AssetService ingestion", () => {
  it("validates the entire batch before querying or writing", async () => {
    const { repository, service, storage } = createHarness();

    await expect(
      service.ingest([
        { buffer: JPEG, clientAssetId: FIRST_CLIENT_ID, originalFilename: "valid.jpg" },
        { buffer: Buffer.alloc(0), clientAssetId: SECOND_CLIENT_ID, originalFilename: "empty.jpg" },
      ]),
    ).rejects.toSatisfy((error: unknown) => {
      expectApiError(error, 400, "INVALID_ASSET_UPLOAD");
      return true;
    });

    expect(repository.findByClientAssetIds).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("rejects non-image bytes and duplicate client IDs before writes", async () => {
    const { repository, service, storage } = createHarness();

    await expect(
      service.ingest([
        { buffer: JPEG, clientAssetId: FIRST_CLIENT_ID, originalFilename: "one.jpg" },
        { buffer: PNG, clientAssetId: FIRST_CLIENT_ID.toUpperCase(), originalFilename: "two.png" },
      ]),
    ).rejects.toMatchObject({ code: "INVALID_ASSET_UPLOAD", statusCode: 400 });
    await expect(
      service.ingest([
        { buffer: Buffer.from("not an image"), clientAssetId: FIRST_CLIENT_ID, originalFilename: "fake.jpg" },
      ]),
    ).rejects.toMatchObject({ code: "INVALID_ASSET_UPLOAD", statusCode: 400 });

    expect(repository.findByClientAssetIds).not.toHaveBeenCalled();
    expect(storage.write).not.toHaveBeenCalled();
  });

  it.each([
    ["a JPEG magic prefix", JPEG.subarray(0, 3)],
    ["a truncated JPEG", JPEG.subarray(0, JPEG.length - 1)],
    ["a PNG signature", PNG.subarray(0, 8)],
    ["a truncated PNG", PNG.subarray(0, PNG.length - 1)],
  ])("rejects %s instead of trusting its prefix", async (_description, buffer) => {
    const { repository, service, storage } = createHarness();

    await expect(
      service.ingest([{ buffer, clientAssetId: FIRST_CLIENT_ID, originalFilename: "image" }]),
    ).rejects.toMatchObject({ code: "INVALID_ASSET_UPLOAD", statusCode: 400 });

    expect(repository.findByClientAssetIds).not.toHaveBeenCalled();
    expect(storage.write).not.toHaveBeenCalled();
  });

  it.each([
    ["a corrupted PNG chunk", pngWithCorruptedImageData()],
    [
      "an image edge above the dimension limit",
      jpegWithDimensions(MAX_ASSET_IMAGE_DIMENSION + 1, 1),
    ],
    ["an image above the pixel limit", jpegWithDimensions(10_000, 5_001)],
  ])("rejects %s before persistence", async (_description, buffer) => {
    const { repository, service, storage } = createHarness();

    await expect(
      service.ingest([{ buffer, clientAssetId: FIRST_CLIENT_ID, originalFilename: "image" }]),
    ).rejects.toMatchObject({ code: "INVALID_ASSET_UPLOAD", statusCode: 400 });

    expect(repository.findByClientAssetIds).not.toHaveBeenCalled();
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("enforces batch and file-size limits before writes", async () => {
    const { repository, service, storage } = createHarness();
    const tooManyUploads = Array.from({ length: MAX_ASSET_UPLOAD_FILES + 1 }, () => ({
      buffer: JPEG,
      clientAssetId: FIRST_CLIENT_ID,
      originalFilename: "image.jpg",
    }));

    await expect(service.ingest(tooManyUploads)).rejects.toMatchObject({
      code: "UPLOAD_FILE_LIMIT_EXCEEDED",
      statusCode: 400,
    });

    const oversizedImage = Buffer.alloc(MAX_ASSET_UPLOAD_FILE_SIZE_BYTES + 1);
    JPEG.copy(oversizedImage);
    await expect(
      service.ingest([
        { buffer: oversizedImage, clientAssetId: FIRST_CLIENT_ID, originalFilename: "large.jpg" },
      ]),
    ).rejects.toMatchObject({ code: "UPLOAD_FILE_TOO_LARGE", statusCode: 413 });

    expect(repository.findByClientAssetIds).not.toHaveBeenCalled();
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("stores JPEG and PNG bytes independently before inserting queued records", async () => {
    const { repository, service, storage } = createHarness();
    const events: string[] = [];
    let nextId = 0;
    vi.mocked(storage.write).mockImplementation(async (_buffer, extension) => {
      events.push(`write:${extension}`);
      return `stored/${nextId}.${extension}`;
    });
    vi.mocked(repository.insert).mockImplementation(async (record) => {
      events.push("insert");
      const id = [FIRST_ASSET_ID, SECOND_ASSET_ID][nextId];
      nextId += 1;
      return { id, ...record };
    });

    const result = await service.ingest([
      {
        buffer: JPEG,
        clientAssetId: FIRST_CLIENT_ID,
        originalFilename: "C:\\fakepath\\001-zendaya__met.gala.JPG",
      },
      {
        buffer: PNG,
        clientAssetId: SECOND_CLIENT_ID,
        originalFilename: "/tmp/02_Anya-Taylor_Joy.png",
      },
    ]);

    expect(events).toEqual(["write:jpg", "insert", "write:png", "insert"]);
    expect(storage.write).toHaveBeenNthCalledWith(1, JPEG, "jpg");
    expect(storage.write).toHaveBeenNthCalledWith(2, PNG, "png");
    expect(repository.insert).toHaveBeenCalledTimes(2);

    const firstRecord = vi.mocked(repository.insert).mock.calls[0]?.[0];
    expect(firstRecord).toEqual({
      ingest: {
        clientAssetId: FIRST_CLIENT_ID,
        originalFilename: "001-zendaya__met.gala.JPG",
      },
      storage: {
        checksumSha256: checksum(JPEG),
        key: "stored/0.jpg",
        mimeType: "image/jpeg",
        provider: "local",
        sizeBytes: JPEG.length,
      },
      sourceText: {
        altText: null,
        backstory: null,
        caption: null,
        revision: 1,
        title: "zendaya met gala",
        updatedAt: FIXED_TIME,
      },
      recognition: {
        attemptNumber: 0,
        availableAt: FIXED_TIME,
        provider: "aws-rekognition",
        queuedAt: FIXED_TIME,
        revision: 1,
        status: "QUEUED",
      },
      enrichment: { associations: [], hideFromSearch: false },
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    });
    expect(result).toEqual({
      assets: [
        expect.objectContaining({
          assetId: FIRST_ASSET_ID,
          created: true,
          links: {
            admin: `/admin/photos/${FIRST_ASSET_ID}`,
            image: `/api/assets/${FIRST_ASSET_ID}/image`,
            self: `/api/assets/${FIRST_ASSET_ID}`,
          },
          originalFilename: "001-zendaya__met.gala.JPG",
          recognitionStatus: "QUEUED",
        }),
        expect.objectContaining({
          assetId: SECOND_ASSET_ID,
          created: true,
          mimeType: "image/png",
          originalFilename: "02_Anya-Taylor_Joy.png",
          sourceText: expect.objectContaining({ title: "Anya Taylor Joy" }),
        }),
      ],
      createdAny: true,
    });
  });

  it("caps display filenames and always derives a non-empty initial title", async () => {
    const { repository, service } = createHarness();

    await service.ingest([
      { buffer: JPEG, clientAssetId: FIRST_CLIENT_ID, originalFilename: "../../000.jpg" },
      {
        buffer: PNG,
        clientAssetId: SECOND_CLIENT_ID,
        originalFilename: `${"x".repeat(300)}.png`,
      },
    ]);

    const firstRecord = vi.mocked(repository.insert).mock.calls[0]?.[0];
    const secondRecord = vi.mocked(repository.insert).mock.calls[1]?.[0];
    expect(firstRecord?.ingest.originalFilename).toBe("000.jpg");
    expect(firstRecord?.sourceText.title).toBe("image");
    expect(secondRecord?.ingest.originalFilename).toHaveLength(255);
    expect(secondRecord?.ingest.originalFilename).toMatch(/\.png$/);
    expect(secondRecord?.sourceText.title).toBeTruthy();
  });

  it("stores face-free images without queuing celebrity recognition", async () => {
    const { repository, service } = createHarness();

    const result = await service.ingest([{
      buffer: JPEG,
      clientAssetId: FIRST_CLIENT_ID,
      originalFilename: "venue.jpg",
      recognitionRequested: false,
    }]);

    expect(repository.insert).toHaveBeenCalledWith(expect.objectContaining({
      recognition: {
        attemptNumber: 0,
        completedAt: FIXED_TIME,
        provider: "aws-rekognition",
        revision: 1,
        status: "SKIPPED",
      },
    }));
    expect(result.assets[0]).toMatchObject({
      originalFilename: "venue.jpg",
      recognitionStatus: "SKIPPED",
    });
  });

  it("returns a matching idempotent upload without writing it again", async () => {
    const { repository, service, storage } = createHarness();
    const existing = makeRecord();
    vi.mocked(repository.findByClientAssetIds).mockResolvedValue(new Map([[FIRST_CLIENT_ID, existing]]));

    const result = await service.ingest([
      { buffer: JPEG, clientAssetId: FIRST_CLIENT_ID, originalFilename: "ignored-on-retry.jpg" },
    ]);

    expect(result.createdAny).toBe(false);
    expect(result.assets).toEqual([expect.objectContaining({ assetId: FIRST_ASSET_ID, created: false })]);
    expect(storage.write).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("rejects known idempotency conflicts before writing any new batch item", async () => {
    const { repository, service, storage } = createHarness();
    vi.mocked(repository.findByClientAssetIds).mockResolvedValue(
      new Map([[SECOND_CLIENT_ID, makeRecord({ clientAssetId: SECOND_CLIENT_ID, image: OTHER_JPEG })]]),
    );

    await expect(
      service.ingest([
        { buffer: PNG, clientAssetId: FIRST_CLIENT_ID, originalFilename: "new.png" },
        { buffer: JPEG, clientAssetId: SECOND_CLIENT_ID, originalFilename: "conflict.jpg" },
      ]),
    ).rejects.toMatchObject({ code: "CLIENT_ASSET_ID_CONFLICT", statusCode: 409 });

    expect(storage.write).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("retains the file when an insert error reconciles to no record", async () => {
    const { repository, service, storage } = createHarness();
    const insertionError = new Error("database unavailable");
    vi.mocked(repository.findByClientAssetIds)
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map());
    vi.mocked(storage.write).mockResolvedValue("stored/current.jpg");
    vi.mocked(repository.insert).mockRejectedValue(insertionError);

    await expect(
      service.ingest([{ buffer: JPEG, clientAssetId: FIRST_CLIENT_ID, originalFilename: "first.jpg" }]),
    ).rejects.toBe(insertionError);

    expect(repository.findByClientAssetIds).toHaveBeenCalledTimes(2);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("retains the file when reconciliation finds this attempt's inserted record", async () => {
    const { repository, service, storage } = createHarness();
    const insertionError = new Error("insert acknowledgement failed");
    const inserted = makeRecord({ key: "stored/current.jpg" });
    vi.mocked(repository.findByClientAssetIds)
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([[FIRST_CLIENT_ID, inserted]]));
    vi.mocked(storage.write).mockResolvedValue("stored/current.jpg");
    vi.mocked(repository.insert).mockRejectedValue(insertionError);

    const result = await service.ingest([
      { buffer: JPEG, clientAssetId: FIRST_CLIENT_ID, originalFilename: "first.jpg" },
    ]);

    expect(result).toEqual({
      assets: [expect.objectContaining({ assetId: FIRST_ASSET_ID, created: true })],
      createdAny: true,
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("retains the file when an insert error cannot be reconciled", async () => {
    const { repository, service, storage } = createHarness();
    const insertionError = new Error("insert acknowledgement failed");
    vi.mocked(repository.findByClientAssetIds)
      .mockResolvedValueOnce(new Map())
      .mockRejectedValueOnce(new Error("database unavailable"));
    vi.mocked(storage.write).mockResolvedValue("stored/current.jpg");
    vi.mocked(repository.insert).mockRejectedValue(insertionError);

    await expect(
      service.ingest([{ buffer: JPEG, clientAssetId: FIRST_CLIENT_ID, originalFilename: "first.jpg" }]),
    ).rejects.toBe(insertionError);

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("cleans up and reloads an idempotent winner after a duplicate-insert race", async () => {
    const { repository, service, storage } = createHarness();
    const existing = makeRecord();
    vi.mocked(repository.findByClientAssetIds)
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([[FIRST_CLIENT_ID, existing]]));
    vi.mocked(repository.insert).mockRejectedValue(new DuplicateClientAssetIdError());
    vi.mocked(storage.write).mockResolvedValue("stored/race-loser.jpg");

    const result = await service.ingest([
      { buffer: JPEG, clientAssetId: FIRST_CLIENT_ID, originalFilename: "first.jpg" },
    ]);

    expect(storage.delete).toHaveBeenCalledWith("stored/race-loser.jpg");
    expect(repository.findByClientAssetIds).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      assets: [expect.objectContaining({ assetId: FIRST_ASSET_ID, created: false })],
      createdAny: false,
    });
  });

  it("keeps earlier successful items and makes a whole-batch retry idempotent", async () => {
    const { repository, service, storage } = createHarness();
    const records = new Map<string, AssetRecord>();
    let shouldFailSecond = true;
    let storageSequence = 0;

    vi.mocked(repository.findByClientAssetIds).mockImplementation(async (ids) => {
      return new Map(ids.flatMap((id) => (records.has(id) ? [[id, records.get(id)!]] : [])));
    });
    vi.mocked(storage.write).mockImplementation(async (_buffer, extension) => {
      storageSequence += 1;
      return `stored/${storageSequence}.${extension}`;
    });
    vi.mocked(repository.insert).mockImplementation(async (record: NewAssetRecord) => {
      if (record.ingest.clientAssetId === SECOND_CLIENT_ID && shouldFailSecond) {
        shouldFailSecond = false;
        throw new Error("temporary insert failure");
      }

      const id = record.ingest.clientAssetId === FIRST_CLIENT_ID ? FIRST_ASSET_ID : SECOND_ASSET_ID;
      const inserted = { id, ...record };
      records.set(record.ingest.clientAssetId, inserted);
      return inserted;
    });
    const batch = [
      { buffer: JPEG, clientAssetId: FIRST_CLIENT_ID, originalFilename: "first.jpg" },
      { buffer: PNG, clientAssetId: SECOND_CLIENT_ID, originalFilename: "second.png" },
    ];

    await expect(service.ingest(batch)).rejects.toThrow("temporary insert failure");
    expect(records.has(FIRST_CLIENT_ID)).toBe(true);
    expect(storage.delete).not.toHaveBeenCalled();

    const retry = await service.ingest(batch);

    expect(retry).toEqual({
      assets: [
        expect.objectContaining({ assetId: FIRST_ASSET_ID, created: false }),
        expect.objectContaining({ assetId: SECOND_ASSET_ID, created: true }),
      ],
      createdAny: true,
    });
    expect(storage.write).toHaveBeenCalledTimes(3);
  });
});

describe("AssetService reads", () => {
  it("maps detail and paginated list records to shared DTOs", async () => {
    const { repository, service } = createHarness();
    const first = makeRecord();
    const second = makeRecord({
      clientAssetId: SECOND_CLIENT_ID,
      id: SECOND_ASSET_ID,
      image: PNG,
      originalFilename: "second.png",
    });
    vi.mocked(repository.findById).mockResolvedValue(first);
    vi.mocked(repository.list).mockResolvedValue({ assets: [first, second], hasMore: true });

    await expect(service.getById(FIRST_ASSET_ID)).resolves.toEqual(
      expect.objectContaining({
        assetId: FIRST_ASSET_ID,
        createdAt: FIXED_TIME.toISOString(),
        links: expect.objectContaining({ self: `/api/assets/${FIRST_ASSET_ID}` }),
      }),
    );
    await expect(service.list({ limit: 2 })).resolves.toEqual({
      assets: [
        expect.objectContaining({ assetId: FIRST_ASSET_ID }),
        expect.objectContaining({ assetId: SECOND_ASSET_ID }),
      ],
      nextCursor: SECOND_ASSET_ID,
    });
    expect(repository.list).toHaveBeenCalledWith({ limit: 2 });
  });

  it("returns normalized recognition details without exposing raw provider output", async () => {
    const { repository, service } = createHarness();
    const completedAt = new Date("2027-05-04T12:01:00.000Z");
    const record = makeRecord({
      recognition: {
        attemptNumber: 1,
        completedAt,
        normalizedResult: {
          faces: [],
          model: "deterministic-fake-v1",
          provider: "fake",
          schemaVersion: "1.0",
          unrecognizedFaceCount: 1,
          warnings: [],
        },
        provider: "fake",
        rawResult: { privateProviderPayload: "must-not-leak" },
        status: "SUCCEEDED",
      },
    });
    vi.mocked(repository.findById).mockResolvedValue(record);

    const detail = await service.getById(FIRST_ASSET_ID);

    expect(detail.recognition).toEqual({
      attemptNumber: 1,
      completedAt: completedAt.toISOString(),
      lastError: null,
      provider: "fake",
      result: record.recognition.normalizedResult,
      revision: 1,
      status: "SUCCEEDED",
    });
    expect(detail).not.toHaveProperty("recognition.rawResult");
    expect(JSON.stringify(detail)).not.toContain("must-not-leak");
  });

  it("delegates metadata saves and maps the updated enrichment detail", async () => {
    const { enrichmentService, service } = createHarness();
    const updated = makeRecord({
      recognition: {
        normalizedResult: {
          faces: [],
          model: "RecognizeCelebrities",
          provider: "aws-rekognition",
          schemaVersion: "1.0",
          unrecognizedFaceCount: 0,
          warnings: [],
        },
        revision: 2,
        status: "SUCCEEDED",
      },
    });
    updated.sourceText = {
      ...updated.sourceText,
      backstory: "Photographed shortly before the Met Gala arrival.",
      revision: 2,
      title: "Rihanna in Marc Jacobs",
    };
    updated.enrichment = {
      associations: [],
      decisionEngineVersion: 1,
      evaluatedAt: FIXED_TIME,
      hideFromSearch: true,
      recognitionRevision: 2,
      sourceTextRevision: 2,
    };
    vi.mocked(enrichmentService.updateMetadata).mockResolvedValue(updated);

    const detail = await service.updateMetadata(FIRST_ASSET_ID, {
      backstory: "Photographed shortly before the Met Gala arrival.",
      hideFromSearch: true,
      title: "Rihanna in Marc Jacobs",
    });

    expect(enrichmentService.updateMetadata).toHaveBeenCalledWith(FIRST_ASSET_ID, {
      backstory: "Photographed shortly before the Met Gala arrival.",
      hideFromSearch: true,
      title: "Rihanna in Marc Jacobs",
    });
    expect(detail).toMatchObject({
      enrichment: {
        associations: [],
        decisionEngineVersion: 1,
        evaluatedAt: FIXED_TIME.toISOString(),
        hideFromSearch: true,
        recognitionRevision: 2,
        sourceTextRevision: 2,
      },
      sourceText: {
        backstory: "Photographed shortly before the Met Gala arrival.",
        revision: 2,
        title: "Rihanna in Marc Jacobs",
      },
    });
  });

  it("explicitly requeues only retryable terminal recognition states", async () => {
    const { enrichmentService, repository, storage } = createHarness();
    const service = new AssetService({
      clock: () => FIXED_TIME,
      enrichmentService,
      recognitionProviderName: "fake",
      repository,
      storage,
    });

    await expect(service.retryRecognition(FIRST_ASSET_ID)).resolves.toEqual({
      assetId: FIRST_ASSET_ID,
      recognitionStatus: "QUEUED",
    });
    expect(repository.retryRecognition).toHaveBeenCalledWith(
      FIRST_ASSET_ID,
      FIXED_TIME,
      "fake",
    );

    vi.mocked(repository.retryRecognition).mockResolvedValueOnce({
      outcome: "NOT_RETRYABLE",
      status: "PROCESSING",
    });
    await expect(service.retryRecognition(FIRST_ASSET_ID)).rejects.toMatchObject({
      code: "RECOGNITION_RETRY_NOT_ALLOWED",
      statusCode: 409,
    });

    vi.mocked(repository.retryRecognition).mockResolvedValueOnce({ outcome: "NOT_FOUND" });
    await expect(service.retryRecognition(FIRST_ASSET_ID)).rejects.toMatchObject({
      code: "ASSET_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("returns a safe 404 for missing asset details and images", async () => {
    const { service, storage } = createHarness();

    await expect(service.getById(FIRST_ASSET_ID)).rejects.toMatchObject({
      code: "ASSET_NOT_FOUND",
      message: "The asset was not found.",
      statusCode: 404,
    });
    await expect(service.openImage(FIRST_ASSET_ID)).rejects.toMatchObject({
      code: "ASSET_NOT_FOUND",
      statusCode: 404,
    });
    expect(storage.open).not.toHaveBeenCalled();
  });

  it("opens an image with content metadata and a checksum ETag", async () => {
    const { repository, service, storage } = createHarness();
    const record = makeRecord();
    const stream = Readable.from(JPEG);
    vi.mocked(repository.findById).mockResolvedValue(record);
    vi.mocked(storage.open).mockResolvedValue({ sizeBytes: JPEG.length, stream });

    await expect(service.openImage(FIRST_ASSET_ID)).resolves.toEqual({
      etag: `"${checksum(JPEG)}"`,
      mimeType: "image/jpeg",
      sizeBytes: JPEG.length,
      stream,
    });
    expect(storage.open).toHaveBeenCalledWith(record.storage.key);
  });

  it("converts storage failures and size mismatches to safe server errors", async () => {
    const { repository, service, storage } = createHarness();
    const record = makeRecord();
    vi.mocked(repository.findById).mockResolvedValue(record);
    vi.mocked(storage.open).mockRejectedValueOnce(new Error("/secret/upload/location"));

    await expect(service.openImage(FIRST_ASSET_ID)).rejects.toEqual(
      expect.objectContaining({
        code: "ASSET_IMAGE_UNAVAILABLE",
        message: "The asset image is unavailable.",
        statusCode: 500,
      }),
    );

    const mismatchedStream = Readable.from(JPEG);
    const destroy = vi.spyOn(mismatchedStream, "destroy");
    vi.mocked(storage.open).mockResolvedValueOnce({ sizeBytes: JPEG.length + 1, stream: mismatchedStream });

    await expect(service.openImage(FIRST_ASSET_ID)).rejects.toMatchObject({
      code: "ASSET_IMAGE_UNAVAILABLE",
      statusCode: 500,
    });
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

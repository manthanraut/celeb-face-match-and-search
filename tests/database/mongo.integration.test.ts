import { randomUUID } from "node:crypto";

import { type Db, MongoServerError, ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MongoDatabase } from "../../server/database/MongoDatabase.js";
import { collectionNames, ensureDatabaseIndexes } from "../../server/database/indexes.js";
import {
  DuplicateClientAssetIdError,
  type NewAssetRecord,
} from "../../server/repositories/AssetRepository.js";
import { MongoAssetRepository } from "../../server/repositories/MongoAssetRepository.js";

const testMongoUri = process.env.TEST_MONGODB_URI;
const describeWithMongo = testMongoUri ? describe : describe.skip;

describeWithMongo("MongoDB foundation", () => {
  const databaseName = `celeb_face_match_test_${randomUUID().replaceAll("-", "")}`;
  let connection: MongoDatabase | null = null;
  let database: Db | null = null;
  let assets: MongoAssetRepository | null = null;

  beforeAll(async () => {
    connection = new MongoDatabase({
      databaseName,
      uri: testMongoUri!,
    });
    database = await connection.connect();
    await ensureDatabaseIndexes(database);
    await ensureDatabaseIndexes(database);
    assets = new MongoAssetRepository(database);
  });

  beforeEach(async () => {
    await database?.collection(collectionNames.assets).deleteMany({});
  });

  afterAll(async () => {
    if (!databaseName.startsWith("celeb_face_match_test_")) {
      throw new Error("Refusing to clean an unexpected MongoDB database.");
    }

    try {
      if (database) {
        await database.dropDatabase();
      }
    } finally {
      await connection?.close();
    }
  });

  it("responds to a database ping", async () => {
    await expect(connection?.ping()).resolves.toBeUndefined();
  });

  it("creates stable indexes idempotently", async () => {
    const assetIndexes = await database!.collection(collectionNames.assets).indexes();
    const celebrityIndexes = await database!.collection(collectionNames.celebrities).indexes();
    const galleryUsageIndexes = await database!.collection(collectionNames.galleryUsages).indexes();
    const clientAssetIdIndex = assetIndexes.find(
      (index) => index.name === "assets_client_asset_id_unique",
    );
    const storageKeyIndex = assetIndexes.find(
      (index) => index.name === "assets_storage_key_unique",
    );
    const recognitionQueueIndex = assetIndexes.find(
      (index) => index.name === "assets_recognition_queue",
    );
    const assetListIndex = assetIndexes.find(
      (index) => index.name === "assets_created_at_id_desc",
    );
    const normalizedNameIndex = celebrityIndexes.find(
      (index) => index.name === "celebrities_normalized_name_unique",
    );
    const slugIndex = celebrityIndexes.find((index) => index.name === "celebrities_slug_unique");
    const assetGalleryIndex = galleryUsageIndexes.find(
      (index) => index.name === "gallery_usages_asset_gallery_unique",
    );
    const eventYearAssetIndex = galleryUsageIndexes.find(
      (index) => index.name === "gallery_usages_event_year_asset",
    );

    expect(clientAssetIdIndex).toMatchObject({ unique: true });
    expect(Object.entries(clientAssetIdIndex!.key)).toEqual([["ingest.clientAssetId", 1]]);
    expect(storageKeyIndex).toMatchObject({ unique: true });
    expect(Object.entries(storageKeyIndex!.key)).toEqual([["storage.key", 1]]);
    expect(recognitionQueueIndex?.unique).not.toBe(true);
    expect(Object.entries(recognitionQueueIndex!.key)).toEqual([
      ["recognition.status", 1],
      ["recognition.availableAt", 1],
      ["_id", 1],
    ]);
    expect(assetListIndex?.unique).not.toBe(true);
    expect(Object.entries(assetListIndex!.key)).toEqual([
      ["createdAt", -1],
      ["_id", -1],
    ]);
    expect(normalizedNameIndex).toMatchObject({
      partialFilterExpression: { normalizedName: { $type: "string" } },
      unique: true,
    });
    expect(Object.entries(normalizedNameIndex!.key)).toEqual([["normalizedName", 1]]);
    expect(slugIndex).toMatchObject({
      partialFilterExpression: { slug: { $type: "string" } },
      unique: true,
    });
    expect(Object.entries(slugIndex!.key)).toEqual([["slug", 1]]);
    expect(assetGalleryIndex).toMatchObject({ unique: true });
    expect(Object.entries(assetGalleryIndex!.key)).toEqual([
      ["assetId", 1],
      ["galleryId", 1],
    ]);
    expect(eventYearAssetIndex?.unique).not.toBe(true);
    expect(Object.entries(eventYearAssetIndex!.key)).toEqual([
      ["event", 1],
      ["year", 1],
      ["assetId", 1],
    ]);
  });

  it("enforces one usage per asset and gallery", async () => {
    const galleryUsages = database!.collection(collectionNames.galleryUsages);
    const usage = { assetId: "asset-1", galleryId: "gallery-1" };

    await galleryUsages.insertOne(usage);
    await expect(galleryUsages.insertOne(usage)).rejects.toMatchObject({ code: 11_000 });
    await expect(
      galleryUsages.insertOne({ assetId: "asset-1", galleryId: "gallery-2" }),
    ).resolves.toBeDefined();
    await expect(
      galleryUsages.insertOne({ assetId: "asset-2", galleryId: "gallery-1" }),
    ).resolves.toBeDefined();
  });

  it("round-trips asset records and supports batch lookup", async () => {
    const firstInput = createAsset({
      clientAssetId: randomUUID(),
      createdAt: new Date("2027-05-04T10:00:00.000Z"),
      storageKey: `${randomUUID()}.jpg`,
    });
    const secondInput = createAsset({
      clientAssetId: randomUUID(),
      createdAt: new Date("2027-05-04T11:00:00.000Z"),
      storageKey: `${randomUUID()}.png`,
    });

    const first = await assets!.insert(firstInput);
    const second = await assets!.insert(secondInput);

    expect(first).toEqual({ id: expect.stringMatching(/^[a-f\d]{24}$/), ...firstInput });
    expect(first.sourceText.updatedAt).toBeInstanceOf(Date);
    expect(first.recognition.availableAt).toBeInstanceOf(Date);
    await expect(assets!.findById(first.id)).resolves.toEqual(first);
    await expect(assets!.findById("not-an-object-id")).resolves.toBeNull();

    const storedDocument = await database!.collection(collectionNames.assets).findOne({
      "ingest.clientAssetId": first.ingest.clientAssetId,
    });
    expect(storedDocument?._id).toBeInstanceOf(ObjectId);
    expect(storedDocument).not.toHaveProperty("id");
    expect(storedDocument?.sourceText.updatedAt).toBeInstanceOf(Date);

    const byClientAssetId = await assets!.findByClientAssetIds([
      second.ingest.clientAssetId,
      first.ingest.clientAssetId,
      first.ingest.clientAssetId,
      randomUUID(),
    ]);

    expect([...byClientAssetId.keys()].sort()).toEqual(
      [first.ingest.clientAssetId, second.ingest.clientAssetId].sort(),
    );
    expect(byClientAssetId.get(first.ingest.clientAssetId)).toEqual(first);
    expect(byClientAssetId.get(second.ingest.clientAssetId)).toEqual(second);
    await expect(assets!.findByClientAssetIds([])).resolves.toEqual(new Map());
  });

  it("translates only duplicate client asset IDs to the repository error", async () => {
    const clientAssetId = randomUUID();
    await assets!.insert(
      createAsset({ clientAssetId, storageKey: `${randomUUID()}.jpg` }),
    );

    await expect(
      assets!.insert(createAsset({ clientAssetId, storageKey: `${randomUUID()}.jpg` })),
    ).rejects.toBeInstanceOf(DuplicateClientAssetIdError);

    const storageKey = `${randomUUID()}.jpg`;
    await assets!.insert(createAsset({ clientAssetId: randomUUID(), storageKey }));
    const duplicateStorageKey = assets!.insert(
      createAsset({ clientAssetId: randomUUID(), storageKey }),
    );

    await expect(duplicateStorageKey).rejects.toBeInstanceOf(MongoServerError);
    await expect(duplicateStorageKey).rejects.not.toBeInstanceOf(DuplicateClientAssetIdError);
  });

  it("lists assets newest first without gaps when timestamps match", async () => {
    const sharedTimestamp = new Date("2027-05-04T11:00:00.000Z");
    const oldest = await assets!.insert(
      createAsset({ createdAt: new Date("2027-05-04T10:00:00.000Z") }),
    );
    const firstAtSharedTimestamp = await assets!.insert(
      createAsset({ createdAt: sharedTimestamp }),
    );
    const secondAtSharedTimestamp = await assets!.insert(
      createAsset({ createdAt: sharedTimestamp }),
    );
    const newest = await assets!.insert(
      createAsset({ createdAt: new Date("2027-05-04T12:00:00.000Z") }),
    );

    const firstPage = await assets!.list({ limit: 2 });
    const secondPage = await assets!.list({ cursor: firstPage.assets.at(-1)!.id, limit: 2 });

    expect(firstPage).toEqual({
      assets: [newest, secondAtSharedTimestamp],
      hasMore: true,
    });
    expect(secondPage).toEqual({
      assets: [firstAtSharedTimestamp, oldest],
      hasMore: false,
    });
    await expect(assets!.list({ cursor: "invalid", limit: 2 })).resolves.toEqual({
      assets: [],
      hasMore: false,
    });
    await expect(
      assets!.list({ cursor: new ObjectId().toHexString(), limit: 2 }),
    ).resolves.toEqual({ assets: [], hasMore: false });
  });
});

function createAsset(
  options: {
    clientAssetId?: string;
    createdAt?: Date;
    storageKey?: string;
  } = {},
): NewAssetRecord {
  const createdAt = options.createdAt ?? new Date("2027-05-04T10:00:00.000Z");

  return {
    ingest: {
      clientAssetId: options.clientAssetId ?? randomUUID(),
      originalFilename: "arrival.jpg",
    },
    storage: {
      checksumSha256: "b".repeat(64),
      key: options.storageKey ?? `${randomUUID()}.jpg`,
      mimeType: "image/jpeg",
      provider: "local",
      sizeBytes: 1_024,
    },
    sourceText: {
      altText: "A celebrity arriving at the gala",
      caption: "Arrival on the Met Gala carpet",
      revision: 1,
      title: "Met Gala arrival",
      updatedAt: createdAt,
    },
    recognition: {
      attemptNumber: 0,
      availableAt: createdAt,
      provider: "aws-rekognition",
      queuedAt: createdAt,
      revision: 1,
      status: "QUEUED",
    },
    enrichment: {
      associations: [
        {
          confidence: 97.25,
          decision: "APPROVED",
          displayName: "Example Celebrity",
          evidenceFields: ["title", "caption"],
          identityKey: "example-celebrity",
          providerPersonId: "person-123",
          source: "recognition",
        },
      ],
      searchReady: true,
    },
    createdAt,
    updatedAt: createdAt,
  };
}

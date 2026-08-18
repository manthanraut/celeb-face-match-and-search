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
import { MongoCelebrityRepository } from "../../server/repositories/MongoCelebrityRepository.js";
import {
  MongoGalleryUsageRepository,
  type GalleryUsageDocument,
} from "../../server/repositories/MongoGalleryUsageRepository.js";

const testMongoUri = process.env.TEST_MONGODB_URI;
const describeWithMongo = testMongoUri ? describe : describe.skip;

describeWithMongo("MongoDB foundation", () => {
  const databaseName = `celeb_face_match_test_${randomUUID().replaceAll("-", "")}`;
  let connection: MongoDatabase | null = null;
  let database: Db | null = null;
  let assets: MongoAssetRepository | null = null;
  let celebrities: MongoCelebrityRepository | null = null;
  let galleryUsages: MongoGalleryUsageRepository | null = null;

  beforeAll(async () => {
    connection = new MongoDatabase({
      databaseName,
      uri: testMongoUri!,
    });
    database = await connection.connect();
    await ensureDatabaseIndexes(database);
    await ensureDatabaseIndexes(database);
    assets = new MongoAssetRepository(database);
    celebrities = new MongoCelebrityRepository(database);
    galleryUsages = new MongoGalleryUsageRepository(database);
  });

  beforeEach(async () => {
    await database?.collection(collectionNames.assets).deleteMany({});
    await database?.collection(collectionNames.celebrities).deleteMany({});
    await database?.collection(collectionNames.galleryUsages).deleteMany({});
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
    const recognitionLeaseIndex = assetIndexes.find(
      (index) => index.name === "assets_recognition_lease_expiry",
    );
    const assetListIndex = assetIndexes.find(
      (index) => index.name === "assets_created_at_id_desc",
    );
    const normalizedNameIndex = celebrityIndexes.find(
      (index) => index.name === "celebrities_normalized_name_unique",
    );
    const slugIndex = celebrityIndexes.find((index) => index.name === "celebrities_slug_unique");
    const aliasIndex = celebrityIndexes.find(
      (index) => index.name === "celebrities_normalized_aliases",
    );
    const assetGalleryIndex = galleryUsageIndexes.find(
      (index) => index.name === "gallery_usages_asset_gallery_unique",
    );
    const eventYearAssetIndex = galleryUsageIndexes.find(
      (index) => index.name === "gallery_usages_event_year_asset",
    );
    const publishedRecencyIndex = galleryUsageIndexes.find(
      (index) => index.name === "gallery_usages_published_recency",
    );
    const publishedEventYearRecencyIndex = galleryUsageIndexes.find(
      (index) => index.name === "gallery_usages_published_event_year_recency",
    );
    const publishedEventRecencyIndex = galleryUsageIndexes.find(
      (index) => index.name === "gallery_usages_published_event_recency",
    );
    const publishedYearRecencyIndex = galleryUsageIndexes.find(
      (index) => index.name === "gallery_usages_published_year_recency",
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
    expect(recognitionLeaseIndex?.unique).not.toBe(true);
    expect(Object.entries(recognitionLeaseIndex!.key)).toEqual([
      ["recognition.status", 1],
      ["recognition.lease.expiresAt", 1],
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
    expect(aliasIndex?.unique).not.toBe(true);
    expect(Object.entries(aliasIndex!.key)).toEqual([["normalizedAliases", 1]]);
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
    expect(Object.entries(publishedRecencyIndex!.key)).toEqual([
      ["published", 1],
      ["addedAt", -1],
      ["assetId", -1],
      ["galleryId", -1],
    ]);
    expect(Object.entries(publishedEventYearRecencyIndex!.key)).toEqual([
      ["published", 1],
      ["event", 1],
      ["year", 1],
      ["addedAt", -1],
      ["assetId", -1],
      ["galleryId", -1],
    ]);
    expect(Object.entries(publishedEventRecencyIndex!.key)).toEqual([
      ["published", 1],
      ["event", 1],
      ["addedAt", -1],
      ["assetId", -1],
      ["galleryId", -1],
    ]);
    expect(Object.entries(publishedYearRecencyIndex!.key)).toEqual([
      ["published", 1],
      ["year", 1],
      ["addedAt", -1],
      ["assetId", -1],
      ["galleryId", -1],
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

  it("syncs gallery usages idempotently and removes stale assets", async () => {
    const first = await assets!.insert(createAsset());
    const second = await assets!.insert(createAsset());
    const replacement = await assets!.insert(createAsset());
    const addedAt = new Date("2027-05-04T12:00:00.000Z");
    const updatedAt = new Date("2027-05-04T13:00:00.000Z");

    await galleryUsages!.syncGallery({
      assetIds: [first.id, second.id],
      event: "met-gala",
      eventName: "Met Gala",
      galleryId: "gallery-1",
      published: false,
      updatedAt: addedAt,
      year: 2026,
    });
    await galleryUsages!.syncGallery({
      assetIds: [first.id, second.id],
      event: "met-gala",
      eventName: "Met Gala",
      galleryId: "gallery-1",
      published: false,
      updatedAt: addedAt,
      year: 2026,
    });

    expect(
      await database!
        .collection<GalleryUsageDocument>(collectionNames.galleryUsages)
        .countDocuments({ galleryId: "gallery-1" }),
    ).toBe(2);

    await galleryUsages!.syncGallery({
      assetIds: [first.id, replacement.id],
      event: "oscars",
      eventName: "Oscars",
      galleryId: "gallery-1",
      published: true,
      updatedAt,
      year: 2027,
    });

    const documents = await database!
      .collection<GalleryUsageDocument>(collectionNames.galleryUsages)
      .find({ galleryId: "gallery-1" })
      .sort({ assetId: 1 })
      .toArray();
    const retained = documents.find((document) => document.assetId === first.id);
    const inserted = documents.find((document) => document.assetId === replacement.id);

    expect(documents.map((document) => document.assetId).sort()).toEqual(
      [first.id, replacement.id].sort(),
    );
    expect(documents.some((document) => document.assetId === second.id)).toBe(false);
    expect(retained).toMatchObject({
      addedAt,
      event: "oscars",
      eventName: "Oscars",
      published: true,
      updatedAt,
      year: 2027,
    });
    expect(inserted).toMatchObject({ addedAt: updatedAt });
    await expect(assets!.findById(first.id)).resolves.toEqual(first);

    await expect(galleryUsages!.removeAsset("gallery-1", first.id)).resolves.toBe(true);
    await expect(galleryUsages!.removeAsset("gallery-1", first.id)).resolves.toBe(false);
    await galleryUsages!.syncGallery({
      assetIds: [],
      event: null,
      eventName: null,
      galleryId: "gallery-1",
      published: false,
      updatedAt,
      year: null,
    });
    expect(
      await database!
        .collection(collectionNames.galleryUsages)
        .countDocuments({ galleryId: "gallery-1" }),
    ).toBe(0);
  });

  it("finds only existing gallery asset IDs", async () => {
    const first = await assets!.insert(createAsset());
    const second = await assets!.insert(createAsset());
    const missingId = new ObjectId().toHexString();

    await expect(
      assets!.findExistingAssetIds([first.id, missingId, second.id, first.id]),
    ).resolves.toEqual(new Set([first.id, second.id]));
    await expect(assets!.findExistingAssetIds([])).resolves.toEqual(new Set());
  });

  it("returns only published usages with approved current celebrity enrichment", async () => {
    const createRetrievalAsset = async ({
      decision = "APPROVED",
      decisionEngineVersion = 1,
      identityKey = "rihanna",
      recognitionRevision = 2,
      sourceTextRevision = 1,
    }: {
      decision?: "APPROVED" | "NEEDS_REVIEW";
      decisionEngineVersion?: number;
      identityKey?: string;
      recognitionRevision?: number;
      sourceTextRevision?: number;
    } = {}) =>
      assets!.insert(
        createAsset({
          enrichment: {
            associations: [
              {
                confidence: 99.4,
                decision,
                displayName: identityKey === "rihanna" ? "Rihanna" : "Zendaya",
                evidenceFields: [],
                identityKey,
                providerPersonId: `person-${identityKey}`,
                source: "recognition",
              },
            ],
            decisionEngineVersion,
            evaluatedAt: new Date("2027-05-04T11:00:00.000Z"),
            recognitionRevision,
            searchReady: decision === "APPROVED",
            sourceTextRevision,
          },
          recognition: {
            revision: 2,
            status: "SUCCEEDED",
          },
        }),
      );
    const approved = await createRetrievalAsset();
    const needsReview = await createRetrievalAsset({ decision: "NEEDS_REVIEW" });
    const staleRecognition = await createRetrievalAsset({ recognitionRevision: 1 });
    const staleMetadata = await createRetrievalAsset({ sourceTextRevision: 2 });
    const staleEngine = await createRetrievalAsset({ decisionEngineVersion: 0 });
    const otherCelebrity = await createRetrievalAsset({ identityKey: "zendaya" });
    const unpublished = await createRetrievalAsset();
    const addedAt = new Date("2027-05-04T12:00:00.000Z");

    await galleryUsages!.syncGallery({
      assetIds: [
        approved.id,
        needsReview.id,
        staleRecognition.id,
        staleMetadata.id,
        staleEngine.id,
        otherCelebrity.id,
      ],
      event: "met-gala",
      eventName: "Met Gala",
      galleryId: "published-gallery",
      published: true,
      updatedAt: addedAt,
      year: 2027,
    });
    await galleryUsages!.syncGallery({
      assetIds: [unpublished.id],
      event: "met-gala",
      eventName: "Met Gala",
      galleryId: "draft-gallery",
      published: false,
      updatedAt: addedAt,
      year: 2027,
    });

    await expect(
      galleryUsages!.findApprovedCelebrityUsages({
        celebritySlug: "rihanna",
        decisionEngineVersion: 1,
        filters: {},
        limit: 20,
      }),
    ).resolves.toMatchObject({
      hasMore: false,
      items: [
        {
          addedAt,
          assetId: approved.id,
          event: "met-gala",
          eventName: "Met Gala",
          galleryId: "published-gallery",
          year: 2027,
        },
      ],
    });
  });

  it("filters and paginates celebrity usages with deterministic tie breaking", async () => {
    const createApprovedAsset = () =>
      assets!.insert(
        createAsset({
          enrichment: {
            associations: [
              {
                confidence: 99.4,
                decision: "APPROVED",
                displayName: "Rihanna",
                evidenceFields: ["title"],
                identityKey: "rihanna",
                providerPersonId: "person-rihanna",
                source: "recognition",
              },
            ],
            decisionEngineVersion: 1,
            evaluatedAt: new Date("2027-05-04T11:00:00.000Z"),
            recognitionRevision: 2,
            searchReady: true,
            sourceTextRevision: 1,
          },
          recognition: { revision: 2, status: "SUCCEEDED" },
        }),
      );
    const first = await createApprovedAsset();
    const second = await createApprovedAsset();
    const oscars = await createApprovedAsset();
    const metGalaAddedAt = new Date("2027-05-04T12:00:00.000Z");

    await galleryUsages!.syncGallery({
      assetIds: [first.id, second.id],
      event: "met-gala",
      eventName: "Met Gala",
      galleryId: "met-gala-2027",
      published: true,
      updatedAt: metGalaAddedAt,
      year: 2027,
    });
    await galleryUsages!.syncGallery({
      assetIds: [oscars.id],
      event: "oscars",
      eventName: "Oscars",
      galleryId: "oscars-2026",
      published: true,
      updatedAt: new Date("2027-05-05T12:00:00.000Z"),
      year: 2026,
    });

    const expectedMetGalaOrder = [first.id, second.id].sort().reverse();
    const firstPage = await galleryUsages!.findApprovedCelebrityUsages({
      celebritySlug: "rihanna",
      decisionEngineVersion: 1,
      filters: { event: "met-gala", year: 2027 },
      limit: 1,
    });
    const secondPage = await galleryUsages!.findApprovedCelebrityUsages({
      celebritySlug: "rihanna",
      cursor: {
        addedAt: firstPage.items[0].addedAt,
        assetId: firstPage.items[0].assetId,
        galleryId: firstPage.items[0].galleryId,
      },
      decisionEngineVersion: 1,
      filters: { event: "met-gala", year: 2027 },
      limit: 1,
    });
    const yearFiltered = await galleryUsages!.findApprovedCelebrityUsages({
      celebritySlug: "rihanna",
      decisionEngineVersion: 1,
      filters: { year: 2026 },
      limit: 20,
    });

    expect(firstPage).toMatchObject({
      hasMore: true,
      items: [{ assetId: expectedMetGalaOrder[0] }],
    });
    expect(secondPage).toMatchObject({
      hasMore: false,
      items: [{ assetId: expectedMetGalaOrder[1] }],
    });
    expect(yearFiltered).toMatchObject({
      hasMore: false,
      items: [{ assetId: oscars.id, event: "oscars", year: 2026 }],
    });
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

  it("atomically claims a queued job and rejects stale lease completion", async () => {
    const inserted = await assets!.insert(createAsset());
    const now = new Date("2027-05-04T12:00:00.000Z");
    const claim = (leaseToken: string) =>
      assets!.claimRecognitionJob({
        leaseDurationMs: 30_000,
        leaseToken,
        maxAttempts: 3,
        now,
        providerName: "aws-rekognition",
        workerId: "worker-1",
      });

    const claims = await Promise.all([claim("lease-a"), claim("lease-b")]);
    const claimed = claims.find((job) => job !== null)!;

    expect(claims.filter((job) => job !== null)).toHaveLength(1);
    expect(claimed).toMatchObject({
      assetId: inserted.id,
      attemptNumber: 1,
      recognitionRevision: 1,
    });
    await expect(
      assets!.completeRecognitionJob(
        { ...claimed, leaseToken: "stale-token" },
        {
          normalizedResult: {
            faces: [],
            model: "RecognizeCelebrities",
            provider: "aws-rekognition",
            schemaVersion: "1.0",
            unrecognizedFaceCount: 1,
            warnings: [],
          },
          rawResult: { CelebrityFaces: [], UnrecognizedFaces: [{}] },
        },
        now,
      ),
    ).resolves.toBe(false);

    const normalizedResult = {
      faces: [],
      model: "RecognizeCelebrities",
      provider: "aws-rekognition" as const,
      schemaVersion: "1.0" as const,
      unrecognizedFaceCount: 1,
      warnings: [],
    };
    await expect(
      assets!.completeRecognitionJob(
        claimed,
        {
          normalizedResult,
          rawResult: { CelebrityFaces: [], UnrecognizedFaces: [{}] },
        },
        now,
      ),
    ).resolves.toBe(true);

    const completed = await assets!.findById(inserted.id);
    expect(completed?.recognition).toMatchObject({
      attemptNumber: 1,
      normalizedResult,
      rawResult: { CelebrityFaces: [], UnrecognizedFaces: [{}] },
      revision: 2,
      status: "SUCCEEDED",
    });
    expect(completed?.enrichment).toEqual(inserted.enrichment);
  });

  it("explicitly retries terminal work and switches it to the configured provider", async () => {
    const completedAt = new Date("2027-05-04T11:00:00.000Z");
    const inserted = await assets!.insert(
      createAsset({
        recognition: {
          attemptNumber: 3,
          completedAt,
          lastError: {
            code: "RECOGNITION_PROVIDER_UNAVAILABLE",
            message: "Recognition failed.",
            recordedAt: completedAt,
            retryable: true,
          },
          normalizedResult: {
            faces: [],
            model: "RecognizeCelebrities",
            provider: "aws-rekognition",
            schemaVersion: "1.0",
            unrecognizedFaceCount: 0,
            warnings: [],
          },
          rawResult: { private: true },
          status: "FAILED",
        },
      }),
    );
    const retriedAt = new Date("2027-05-04T12:00:00.000Z");

    await expect(assets!.retryRecognition(inserted.id, retriedAt, "fake")).resolves.toEqual({
      outcome: "REQUEUED",
    });

    const retried = await assets!.findById(inserted.id);
    expect(retried?.recognition).toMatchObject({
      attemptNumber: 0,
      availableAt: retriedAt,
      provider: "fake",
      queuedAt: retriedAt,
      revision: 2,
      status: "QUEUED",
    });
    expect(retried?.recognition).not.toHaveProperty("completedAt");
    expect(retried?.recognition).not.toHaveProperty("lastError");
    expect(retried?.recognition).not.toHaveProperty("normalizedResult");
    expect(retried?.recognition).not.toHaveProperty("rawResult");
    expect(retried?.enrichment).toEqual({ associations: [], searchReady: false });
    await expect(assets!.retryRecognition(inserted.id, retriedAt, "fake")).resolves.toEqual({
      outcome: "NOT_RETRYABLE",
      status: "QUEUED",
    });
  });

  it("recovers expired leases without repeating an exhausted automatic attempt", async () => {
    const expiredAt = new Date("2027-05-04T11:59:00.000Z");
    const now = new Date("2027-05-04T12:00:00.000Z");
    const retryable = await assets!.insert(
      createAsset({
        recognition: {
          attemptNumber: 1,
          lease: {
            claimedAt: new Date("2027-05-04T11:58:30.000Z"),
            expiresAt: expiredAt,
            ownerId: "dead-worker",
            token: "expired-1",
          },
          startedAt: new Date("2027-05-04T11:58:30.000Z"),
          status: "PROCESSING",
        },
      }),
    );
    const exhausted = await assets!.insert(
      createAsset({
        recognition: {
          attemptNumber: 3,
          lease: {
            claimedAt: new Date("2027-05-04T11:58:30.000Z"),
            expiresAt: expiredAt,
            ownerId: "dead-worker",
            token: "expired-2",
          },
          startedAt: new Date("2027-05-04T11:58:30.000Z"),
          status: "PROCESSING",
        },
      }),
    );

    await expect(assets!.recoverExpiredRecognitionJobs(now, 3)).resolves.toEqual({
      indeterminateCount: 1,
      requeuedCount: 1,
    });
    expect((await assets!.findById(retryable.id))?.recognition).toMatchObject({
      lastError: { code: "RECOGNITION_LEASE_EXPIRED", retryable: true },
      status: "QUEUED",
    });
    expect((await assets!.findById(exhausted.id))?.recognition).toMatchObject({
      completedAt: now,
      lastError: { code: "RECOGNITION_LEASE_EXHAUSTED", retryable: false },
      status: "INDETERMINATE",
    });
  });

  it("applies enrichment only to the recognition and metadata revisions it evaluated", async () => {
    const inserted = await assets!.insert(
      createAsset({
        enrichment: { associations: [], searchReady: false },
        recognition: {
          normalizedResult: {
            faces: [],
            model: "RecognizeCelebrities",
            provider: "aws-rekognition",
            schemaVersion: "1.0",
            unrecognizedFaceCount: 1,
            warnings: [],
          },
          revision: 2,
          status: "SUCCEEDED",
        },
      }),
    );
    const evaluatedAt = new Date("2027-05-04T12:00:00.000Z");
    const enrichment = {
      associations: [],
      decisionEngineVersion: 1,
      evaluatedAt,
      recognitionRevision: 2,
      searchReady: false,
      sourceTextRevision: 1,
    };

    await expect(assets!.findPendingEnrichmentAsset(1)).resolves.toMatchObject({ id: inserted.id });
    await expect(
      assets!.applyEnrichment({
        assetId: inserted.id,
        enrichment,
        expectedRecognitionRevision: 1,
        expectedRecognitionStatus: "SUCCEEDED",
        expectedSourceTextRevision: 1,
        updatedAt: evaluatedAt,
      }),
    ).resolves.toBe(false);
    await expect(
      assets!.applyEnrichment({
        assetId: inserted.id,
        enrichment,
        expectedRecognitionRevision: 2,
        expectedRecognitionStatus: "SUCCEEDED",
        expectedSourceTextRevision: 1,
        updatedAt: evaluatedAt,
      }),
    ).resolves.toBe(true);
    await expect(assets!.findPendingEnrichmentAsset(1)).resolves.toBeNull();
  });

  it("saves metadata and enrichment atomically and rejects a stale editorial revision", async () => {
    const inserted = await assets!.insert(
      createAsset({
        enrichment: { associations: [], searchReady: false },
        recognition: {
          normalizedResult: {
            faces: [],
            model: "RecognizeCelebrities",
            provider: "aws-rekognition",
            schemaVersion: "1.0",
            unrecognizedFaceCount: 1,
            warnings: [],
          },
          revision: 2,
          status: "SUCCEEDED",
        },
      }),
    );
    const updatedAt = new Date("2027-05-04T12:00:00.000Z");
    const sourceText = {
      ...inserted.sourceText,
      revision: 2,
      title: "Rihanna in Marc Jacobs",
      updatedAt,
    };
    const enrichment = {
      associations: [
        {
          confidence: null,
          decision: "APPROVED" as const,
          displayName: "Rihanna",
          evidenceFields: ["title" as const],
          identityKey: "rihanna",
          providerPersonId: null,
          source: "metadata-inference" as const,
        },
      ],
      decisionEngineVersion: 1,
      evaluatedAt: updatedAt,
      recognitionRevision: 2,
      searchReady: true,
      sourceTextRevision: 2,
    };
    const update = {
      assetId: inserted.id,
      enrichment,
      expectedRecognitionRevision: 2,
      expectedRecognitionStatus: "SUCCEEDED" as const,
      expectedSourceTextRevision: 1,
      sourceText,
      updatedAt,
    };

    await expect(assets!.saveMetadataAndEnrichment(update)).resolves.toMatchObject({
      enrichment,
      sourceText,
    });
    await expect(assets!.saveMetadataAndEnrichment(update)).resolves.toBeNull();
    expect((await assets!.findById(inserted.id))?.enrichment).toEqual(enrichment);
  });

  it("round-trips the celebrity catalog used by metadata inference", async () => {
    await database!.collection(collectionNames.celebrities).insertOne({
      displayName: "Rihanna",
      normalizedAliases: ["robyn rihanna fenty"],
      normalizedName: "rihanna",
      providerIdentities: [
        { personId: "aws-rihanna", provider: "aws-rekognition" },
      ],
      slug: "rihanna",
    });

    await expect(celebrities!.list()).resolves.toEqual([
      {
        displayName: "Rihanna",
        normalizedAliases: ["robyn rihanna fenty"],
        normalizedName: "rihanna",
        providerIdentities: [
          { personId: "aws-rihanna", provider: "aws-rekognition" },
        ],
        slug: "rihanna",
      },
    ]);
    await expect(celebrities!.findByNormalizedIdentity("rihanna")).resolves.toMatchObject([
      { displayName: "Rihanna", slug: "rihanna" },
    ]);
    await expect(
      celebrities!.findByNormalizedIdentity("robyn rihanna fenty"),
    ).resolves.toMatchObject([{ displayName: "Rihanna", slug: "rihanna" }]);
    await expect(celebrities!.findByNormalizedIdentity("unknown")).resolves.toEqual([]);
    await expect(celebrities!.findBySlug("rihanna")).resolves.toMatchObject({
      displayName: "Rihanna",
      slug: "rihanna",
    });
    await expect(celebrities!.findBySlug("unknown")).resolves.toBeNull();
  });
});

function createAsset(
  options: {
    clientAssetId?: string;
    createdAt?: Date;
    enrichment?: NewAssetRecord["enrichment"];
    recognition?: Partial<NewAssetRecord["recognition"]>;
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
      ...options.recognition,
    },
    enrichment: options.enrichment ?? {
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

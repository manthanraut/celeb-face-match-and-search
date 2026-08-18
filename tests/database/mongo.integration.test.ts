import { randomUUID } from "node:crypto";

import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MongoDatabase } from "../../server/database/MongoDatabase.js";
import { collectionNames, ensureDatabaseIndexes } from "../../server/database/indexes.js";

const testMongoUri = process.env.TEST_MONGODB_URI;
const describeWithMongo = testMongoUri ? describe : describe.skip;

describeWithMongo("MongoDB foundation", () => {
  const databaseName = `celeb_face_match_test_${randomUUID().replaceAll("-", "")}`;
  let connection: MongoDatabase | null = null;
  let database: Db | null = null;

  beforeAll(async () => {
    connection = new MongoDatabase({
      databaseName,
      uri: testMongoUri!,
    });
    database = await connection.connect();
    await ensureDatabaseIndexes(database);
    await ensureDatabaseIndexes(database);
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
    const celebrityIndexes = await database!.collection(collectionNames.celebrities).indexes();
    const galleryUsageIndexes = await database!.collection(collectionNames.galleryUsages).indexes();
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
    await expect(galleryUsages.insertOne({ assetId: "asset-1", galleryId: "gallery-2" })).resolves.toBeDefined();
    await expect(galleryUsages.insertOne({ assetId: "asset-2", galleryId: "gallery-1" })).resolves.toBeDefined();
  });
});

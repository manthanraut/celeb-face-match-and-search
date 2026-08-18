import type { Db, IndexDescription } from "mongodb";

export const collectionNames = {
  assets: "assets",
  celebrities: "celebrities",
  galleryUsages: "gallery_usages",
} as const;

const assetIndexes: IndexDescription[] = [
  {
    key: { "ingest.clientAssetId": 1 },
    name: "assets_client_asset_id_unique",
    unique: true,
  },
  {
    key: { "storage.key": 1 },
    name: "assets_storage_key_unique",
    unique: true,
  },
  {
    key: { "recognition.status": 1, "recognition.availableAt": 1, _id: 1 },
    name: "assets_recognition_queue",
  },
  {
    key: { createdAt: -1, _id: -1 },
    name: "assets_created_at_id_desc",
  },
];

const celebrityIndexes: IndexDescription[] = [
  {
    key: { normalizedName: 1 },
    name: "celebrities_normalized_name_unique",
    partialFilterExpression: { normalizedName: { $type: "string" } },
    unique: true,
  },
  {
    key: { slug: 1 },
    name: "celebrities_slug_unique",
    partialFilterExpression: { slug: { $type: "string" } },
    unique: true,
  },
];

const galleryUsageIndexes: IndexDescription[] = [
  {
    key: { assetId: 1, galleryId: 1 },
    name: "gallery_usages_asset_gallery_unique",
    unique: true,
  },
  {
    key: { event: 1, year: 1, assetId: 1 },
    name: "gallery_usages_event_year_asset",
  },
];

export async function ensureDatabaseIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection(collectionNames.assets).createIndexes(assetIndexes),
    database.collection(collectionNames.celebrities).createIndexes(celebrityIndexes),
    database.collection(collectionNames.galleryUsages).createIndexes(galleryUsageIndexes),
  ]);
}

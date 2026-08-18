import type { Db, IndexDescription } from "mongodb";

export const collectionNames = {
  celebrities: "celebrities",
  galleryUsages: "gallery_usages",
} as const;

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
    database.collection(collectionNames.celebrities).createIndexes(celebrityIndexes),
    database.collection(collectionNames.galleryUsages).createIndexes(galleryUsageIndexes),
  ]);
}

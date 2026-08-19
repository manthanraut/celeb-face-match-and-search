import type { AnyBulkWriteOperation, Db } from "mongodb";

import type { CelebrityCatalogEntry } from "../repositories/CelebrityRepository.js";
import { collectionNames } from "./indexes.js";

export const DEMO_CELEBRITY_CATALOG: readonly CelebrityCatalogEntry[] = [
  {
    displayName: "A$AP Rocky",
    normalizedAliases: ["asap rocky"],
    normalizedName: "a ap rocky",
    providerIdentities: [{ personId: "fake-asap-rocky", provider: "fake" }],
    slug: "a-ap-rocky",
  },
  {
    displayName: "Anya Taylor-Joy",
    normalizedAliases: [],
    normalizedName: "anya taylor joy",
    providerIdentities: [{ personId: "fake-anya-taylor-joy", provider: "fake" }],
    slug: "anya-taylor-joy",
  },
  {
    displayName: "Doja Cat",
    normalizedAliases: [],
    normalizedName: "doja cat",
    providerIdentities: [],
    slug: "doja-cat",
  },
  {
    displayName: "Rihanna",
    normalizedAliases: ["robyn rihanna fenty"],
    normalizedName: "rihanna",
    providerIdentities: [{ personId: "fake-rihanna", provider: "fake" }],
    slug: "rihanna",
  },
  {
    displayName: "Sadie Sink",
    normalizedAliases: [],
    normalizedName: "sadie sink",
    providerIdentities: [],
    slug: "sadie-sink",
  },
  {
    displayName: "Zendaya",
    normalizedAliases: ["zendaya maree stoermer coleman"],
    normalizedName: "zendaya",
    providerIdentities: [{ personId: "fake-zendaya", provider: "fake" }],
    slug: "zendaya",
  },
];

export async function ensureDemoCelebrityCatalog(database: Db): Promise<void> {
  const operations: AnyBulkWriteOperation<CelebrityCatalogEntry>[] =
    DEMO_CELEBRITY_CATALOG.map((celebrity) => ({
      updateOne: {
        filter: { slug: celebrity.slug },
        update: { $setOnInsert: celebrity },
        upsert: true,
      },
    }));

  await database
    .collection<CelebrityCatalogEntry>(collectionNames.celebrities)
    .bulkWrite(operations, { ordered: false });
}

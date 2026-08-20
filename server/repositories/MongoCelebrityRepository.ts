import type { Collection, Db, WithId } from "mongodb";

import { collectionNames } from "../database/indexes.js";
import type {
  CelebrityCatalogEntry,
  CelebrityLookupRepository,
  CelebrityRepository,
} from "./CelebrityRepository.js";

type CelebrityDocument = CelebrityCatalogEntry;

export class MongoCelebrityRepository implements CelebrityRepository, CelebrityLookupRepository {
  readonly #celebrities: Collection<CelebrityDocument>;

  constructor(database: Db) {
    this.#celebrities = database.collection<CelebrityDocument>(collectionNames.celebrities);
  }

  async list(): Promise<CelebrityCatalogEntry[]> {
    const documents = await this.#celebrities.find({}).sort({ normalizedName: 1 }).toArray();
    return documents.map(toCatalogEntry);
  }

  async findByNormalizedIdentity(normalizedIdentity: string): Promise<CelebrityCatalogEntry[]> {
    const exactMatches = await this.#celebrities
      .find({
        $or: [
          { normalizedAliases: normalizedIdentity },
          { normalizedName: normalizedIdentity },
        ],
      })
      .sort({ normalizedName: 1 })
      .limit(2)
      .toArray();
    if (exactMatches.length > 0) {
      return exactMatches.map(toCatalogEntry);
    }

    const prefix = new RegExp(`^${escapeRegularExpression(normalizedIdentity)}`, "u");
    const prefixMatches = await this.#celebrities
      .find({
        $or: [
          { normalizedAliases: prefix },
          { normalizedName: prefix },
        ],
      })
      .sort({ normalizedName: 1 })
      .limit(2)
      .toArray();
    return prefixMatches.map(toCatalogEntry);
  }

  async findBySlug(slug: string): Promise<CelebrityCatalogEntry | null> {
    const document = await this.#celebrities.findOne({ slug });
    return document ? toCatalogEntry(document) : null;
  }
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function toCatalogEntry(document: WithId<CelebrityDocument>): CelebrityCatalogEntry {
  return {
    displayName: document.displayName,
    normalizedAliases: document.normalizedAliases ?? [],
    normalizedName: document.normalizedName,
    providerIdentities: document.providerIdentities ?? [],
    slug: document.slug,
  };
}

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
    const documents = await this.#celebrities
      .find({
        $or: [
          { normalizedAliases: normalizedIdentity },
          { normalizedName: normalizedIdentity },
        ],
      })
      .sort({ normalizedName: 1 })
      .limit(2)
      .toArray();
    return documents.map(toCatalogEntry);
  }

  async findBySlug(slug: string): Promise<CelebrityCatalogEntry | null> {
    const document = await this.#celebrities.findOne({ slug });
    return document ? toCatalogEntry(document) : null;
  }
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

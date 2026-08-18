import type { Collection, Db, WithId } from "mongodb";

import { collectionNames } from "../database/indexes.js";
import type {
  CelebrityCatalogEntry,
  CelebrityRepository,
} from "./CelebrityRepository.js";

type CelebrityDocument = CelebrityCatalogEntry;

export class MongoCelebrityRepository implements CelebrityRepository {
  readonly #celebrities: Collection<CelebrityDocument>;

  constructor(database: Db) {
    this.#celebrities = database.collection<CelebrityDocument>(collectionNames.celebrities);
  }

  async list(): Promise<CelebrityCatalogEntry[]> {
    const documents = await this.#celebrities.find({}).sort({ normalizedName: 1 }).toArray();
    return documents.map(toCatalogEntry);
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

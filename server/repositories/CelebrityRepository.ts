import type { RecognitionProviderName } from "../../shared/contracts/recognition.js";

export interface CelebrityCatalogEntry {
  displayName: string;
  normalizedAliases: string[];
  normalizedName: string;
  providerIdentities: Array<{
    personId: string;
    provider: RecognitionProviderName;
  }>;
  slug: string;
}

export interface CelebrityRepository {
  list(): Promise<CelebrityCatalogEntry[]>;
}

export interface CelebrityLookupRepository {
  findByNormalizedIdentity(normalizedIdentity: string): Promise<CelebrityCatalogEntry[]>;
  findBySlug(slug: string): Promise<CelebrityCatalogEntry | null>;
}

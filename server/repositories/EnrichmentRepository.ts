import type { AssetRecognitionStatus } from "../../shared/assets.js";
import type { AssetRecord } from "./AssetRepository.js";

export interface EnrichmentSnapshot {
  expectedRecognitionRevision: number;
  expectedRecognitionStatus: AssetRecognitionStatus;
  expectedSourceTextRevision: number;
}

export interface ApplyAssetEnrichmentInput extends EnrichmentSnapshot {
  assetId: string;
  enrichment: AssetRecord["enrichment"];
  updatedAt: Date;
}

export interface SaveAssetMetadataInput extends ApplyAssetEnrichmentInput {
  sourceText: AssetRecord["sourceText"];
}

export interface EnrichmentRepository {
  applyEnrichment(input: ApplyAssetEnrichmentInput): Promise<boolean>;
  findPendingEnrichmentAsset(decisionEngineVersion: number): Promise<AssetRecord | null>;
  saveMetadataAndEnrichment(input: SaveAssetMetadataInput): Promise<AssetRecord | null>;
}

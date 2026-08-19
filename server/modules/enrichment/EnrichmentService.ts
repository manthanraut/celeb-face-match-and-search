import type { AssetMetadataUpdate } from "../../../shared/assets.js";
import { ApiError } from "../../middleware/error-handler.js";
import type { AssetRecord, AssetRepository } from "../../repositories/AssetRepository.js";
import type { CelebrityRepository } from "../../repositories/CelebrityRepository.js";
import type { EnrichmentRepository } from "../../repositories/EnrichmentRepository.js";
import {
  CELEBRITY_DECISION_ENGINE_VERSION,
  evaluateCelebrityDecisions,
} from "./decisionEngine.js";

export interface EnrichmentServiceDependencies {
  approvalThreshold: number;
  assetRepository: AssetRepository;
  celebrityRepository: CelebrityRepository;
  clock?: () => Date;
  enrichmentRepository: EnrichmentRepository;
}

const MAX_OPTIMISTIC_UPDATE_ATTEMPTS = 5;

export class EnrichmentService {
  readonly #approvalThreshold: number;
  readonly #assetRepository: AssetRepository;
  readonly #celebrityRepository: CelebrityRepository;
  readonly #clock: () => Date;
  readonly #enrichmentRepository: EnrichmentRepository;

  constructor({
    approvalThreshold,
    assetRepository,
    celebrityRepository,
    clock = () => new Date(),
    enrichmentRepository,
  }: EnrichmentServiceDependencies) {
    this.#approvalThreshold = approvalThreshold;
    this.#assetRepository = assetRepository;
    this.#celebrityRepository = celebrityRepository;
    this.#clock = clock;
    this.#enrichmentRepository = enrichmentRepository;
  }

  async evaluateAsset(assetId: string): Promise<boolean> {
    for (let attempt = 0; attempt < MAX_OPTIMISTIC_UPDATE_ATTEMPTS; attempt += 1) {
      const asset = await this.#assetRepository.findById(assetId);
      if (!asset || asset.recognition.status !== "SUCCEEDED") {
        return false;
      }

      const timestamp = this.#clock();
      const enrichment = await this.#evaluate(asset, timestamp);
      const applied = await this.#enrichmentRepository.applyEnrichment({
        assetId,
        enrichment,
        expectedRecognitionRevision: asset.recognition.revision,
        expectedRecognitionStatus: asset.recognition.status,
        expectedSourceTextRevision: asset.sourceText.revision,
        updatedAt: timestamp,
      });
      if (applied) {
        return true;
      }
    }

    return false;
  }

  async evaluateNextPending(): Promise<boolean> {
    const asset = await this.#enrichmentRepository.findPendingEnrichmentAsset(
      CELEBRITY_DECISION_ENGINE_VERSION,
    );
    if (!asset) {
      return false;
    }

    await this.evaluateAsset(asset.id);
    return true;
  }

  async updateMetadata(assetId: string, update: AssetMetadataUpdate): Promise<AssetRecord> {
    for (let attempt = 0; attempt < MAX_OPTIMISTIC_UPDATE_ATTEMPTS; attempt += 1) {
      const asset = await this.#assetRepository.findById(assetId);
      if (!asset) {
        throw new ApiError(404, "ASSET_NOT_FOUND", "The asset was not found.");
      }

      const timestamp = this.#clock();
      const sourceText: AssetRecord["sourceText"] = {
        altText: normalizeStoredText(update.altText, asset.sourceText.altText),
        backstory: normalizeStoredText(update.backstory, asset.sourceText.backstory),
        caption: normalizeStoredText(update.caption, asset.sourceText.caption),
        revision: asset.sourceText.revision + 1,
        title: normalizeStoredText(update.title, asset.sourceText.title),
        updatedAt: timestamp,
      };
      const enrichment = await this.#evaluate(
        {
          ...asset,
          enrichment: {
            ...asset.enrichment,
            hideFromSearch: update.hideFromSearch ?? asset.enrichment.hideFromSearch,
          },
          sourceText,
        },
        timestamp,
      );
      const updated = await this.#enrichmentRepository.saveMetadataAndEnrichment({
        assetId,
        enrichment,
        expectedRecognitionRevision: asset.recognition.revision,
        expectedRecognitionStatus: asset.recognition.status,
        expectedSourceTextRevision: asset.sourceText.revision,
        sourceText,
        updatedAt: timestamp,
      });
      if (updated) {
        return updated;
      }
    }

    throw new ApiError(
      409,
      "ASSET_UPDATE_CONFLICT",
      "The asset changed while metadata was being saved. Retry the update.",
    );
  }

  async #evaluate(asset: AssetRecord, timestamp = this.#clock()): Promise<AssetRecord["enrichment"]> {
    const recognitionResult =
      asset.recognition.status === "SUCCEEDED"
        ? (asset.recognition.normalizedResult ?? null)
        : null;
    const catalog = recognitionResult ? await this.#celebrityRepository.list() : [];
    const decision = evaluateCelebrityDecisions({
      approvalThreshold: this.#approvalThreshold,
      catalog,
      recognitionResult,
      sourceText: asset.sourceText,
    });

    return {
      associations: decision.associations,
      decisionEngineVersion: decision.decisionEngineVersion,
      evaluatedAt: timestamp,
      hideFromSearch: asset.enrichment.hideFromSearch,
      recognitionRevision: asset.recognition.revision,
      sourceTextRevision: asset.sourceText.revision,
    };
  }
}

function normalizeStoredText(value: string | null | undefined, current: string | null): string | null {
  if (value === undefined) {
    return current;
  }
  if (value === null) {
    return null;
  }

  const normalized = value.replaceAll("\r\n", "\n").trim();
  return normalized || null;
}

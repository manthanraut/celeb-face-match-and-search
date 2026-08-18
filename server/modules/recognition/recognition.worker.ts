import type { FileStorage } from "../../storage/FileStorage.js";
import type { AssetsRepository } from "../assets/assets.repository.js";
import { makeEnrichmentDecision } from "./decision-engine.js";
import type { RecognitionProvider } from "./RecognitionProvider.js";
import type { RecognitionRepository } from "./recognition.repository.js";

export class RecognitionWorker {
  readonly #assets: AssetsRepository;
  readonly #provider: RecognitionProvider;
  readonly #recognitionResults: RecognitionRepository;
  readonly #storage: FileStorage;
  readonly #threshold: number;
  readonly #queuedIds: string[] = [];
  readonly #knownIds = new Set<string>();
  #drainPromise: Promise<void> = Promise.resolve();
  #isDraining = false;

  constructor(
    assets: AssetsRepository,
    recognitionResults: RecognitionRepository,
    storage: FileStorage,
    provider: RecognitionProvider,
    threshold: number,
  ) {
    this.#assets = assets;
    this.#recognitionResults = recognitionResults;
    this.#storage = storage;
    this.#provider = provider;
    this.#threshold = threshold;
  }

  enqueue(assetId: string) {
    if (this.#knownIds.has(assetId)) {
      return;
    }

    this.#knownIds.add(assetId);
    this.#queuedIds.push(assetId);
    if (!this.#isDraining) {
      this.#drainPromise = this.#drain();
    }
  }

  async waitForIdle() {
    await this.#drainPromise;
  }

  async #drain() {
    if (this.#isDraining) {
      return;
    }

    this.#isDraining = true;

    try {
      while (this.#queuedIds.length > 0) {
        const assetId = this.#queuedIds.shift();
        if (!assetId) {
          continue;
        }

        try {
          await this.#process(assetId);
        } finally {
          this.#knownIds.delete(assetId);
        }
      }
    } finally {
      this.#isDraining = false;
    }
  }

  async #process(assetId: string) {
    try {
      const processingAsset = await this.#assets.update(assetId, (asset) => ({
        ...asset,
        recognition: {
          ...asset.recognition,
          attempt: asset.recognition.attempt + 1,
          error: null,
          startedAt: new Date().toISOString(),
          status: "processing",
        },
        updatedAt: new Date().toISOString(),
      }));
      const image = await this.#storage.read(processingAsset.image.storageKey);
      const response = await this.#provider.recognize({
        image,
        mimeType: processingAsset.image.mimeType,
      });

      const rawResponseFile = await this.#recognitionResults.save(assetId, response.rawResponse);

      await this.#assets.update(assetId, (latestAsset) => {
        const decision = makeEnrichmentDecision(
          response.normalizedResult,
          latestAsset.sourceText,
          this.#threshold,
        );
        const searchReady = decision.celebrities.some(
          (celebrity) => celebrity.searchDecision === "Accepted",
        );
        const completedAt = new Date().toISOString();

        return {
          ...latestAsset,
          ...decision,
          enrichmentState: {
            ...latestAsset.enrichmentState,
            imageRecognitionComplete: true,
            searchReady,
          },
          recognition: {
            ...latestAsset.recognition,
            completedAt,
            error: null,
            model: response.normalizedResult.model,
            normalizedResult: response.normalizedResult,
            rawResponseFile,
            status: "completed",
          },
          updatedAt: completedAt,
        };
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : "Celebrity recognition failed.";

      try {
        await this.#assets.update(assetId, (asset) => ({
          ...asset,
          enrichmentState: {
            ...asset.enrichmentState,
            imageRecognitionComplete: false,
            searchReady: false,
          },
          recognition: {
            ...asset.recognition,
            completedAt: new Date().toISOString(),
            error: message,
            status: "failed",
          },
          updatedAt: new Date().toISOString(),
        }));
      } catch (updateError) {
        console.error(`Unable to record recognition failure for ${assetId}.`, updateError);
      }
    }
  }
}

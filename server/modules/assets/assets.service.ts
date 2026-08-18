import path from "node:path";

import {
  photoAssetResponseSchema,
  updateSourceTextInputSchema,
  type PhotoAsset,
  type UpdateSourceTextInput,
} from "../../../shared/contracts/assets.js";
import type { FileStorage } from "../../storage/FileStorage.js";
import { makeEnrichmentDecision } from "../recognition/decision-engine.js";
import type { RecognitionRepository } from "../recognition/recognition.repository.js";
import type { AssetsRepository } from "./assets.repository.js";

interface CreateAssetInput {
  contents: Buffer;
  fileName: string;
  height: number;
  lastModified: number;
  mimeType: "image/jpeg" | "image/png";
  width: number;
}

export class AssetsService {
  readonly #assets: AssetsRepository;
  readonly #recognitionResults: RecognitionRepository;
  readonly #storage: FileStorage;
  readonly #threshold: number;

  constructor(
    assets: AssetsRepository,
    recognitionResults: RecognitionRepository,
    storage: FileStorage,
    threshold: number,
  ) {
    this.#assets = assets;
    this.#recognitionResults = recognitionResults;
    this.#storage = storage;
    this.#threshold = threshold;
  }

  async create(input: CreateAssetInput) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const extension = input.mimeType === "image/png" ? ".png" : ".jpg";
    const storageKey = `uploads/${id}${extension}`;

    await this.#storage.write(storageKey, input.contents);

    const asset: PhotoAsset = {
      celebrities: [],
      createdAt: now,
      designers: [],
      enrichmentState: {
        editorialMetadataProcessed: false,
        galleryContextAvailable: false,
        imageRecognitionComplete: false,
        searchReady: false,
      },
      id,
      image: {
        height: input.height,
        mimeType: input.mimeType,
        originalFileName: path.basename(input.fileName),
        originalLastModified: input.lastModified,
        size: input.contents.byteLength,
        storageKey,
        url: `/api/assets/${id}/image`,
        width: input.width,
      },
      recognition: {
        attempt: 0,
        completedAt: null,
        error: null,
        model: "AWS RecognizeCelebrities",
        normalizedResult: null,
        provider: "aws-rekognition",
        queuedAt: now,
        rawResponseFile: null,
        startedAt: null,
        status: "queued",
        threshold: this.#threshold,
      },
      sourceText: {
        altText: null,
        caption: null,
        title: input.fileName,
      },
      updatedAt: now,
      usages: [],
    };

    try {
      return await this.#assets.create(asset);
    } catch (error) {
      await this.#storage.delete(storageKey);
      throw error;
    }
  }

  async get(assetId: string) {
    const asset = await this.#assets.get(assetId);
    const rawRecognitionResponse = await this.#recognitionResults.get(assetId);
    return photoAssetResponseSchema.parse({ asset, rawRecognitionResponse });
  }

  async getImage(assetId: string) {
    const asset = await this.#assets.get(assetId);
    return { asset, contents: await this.#storage.read(asset.image.storageKey) };
  }

  async queueRecognition(assetId: string) {
    return this.#assets.update(assetId, (asset) => ({
      ...asset,
      enrichmentState: {
        ...asset.enrichmentState,
        imageRecognitionComplete: false,
        searchReady: false,
      },
      recognition: {
        ...asset.recognition,
        completedAt: null,
        error: null,
        queuedAt: new Date().toISOString(),
        startedAt: null,
        status: "queued",
      },
      updatedAt: new Date().toISOString(),
    }));
  }

  async updateSourceText(assetId: string, input: UpdateSourceTextInput) {
    const validatedInput = updateSourceTextInputSchema.parse(input);

    return this.#assets.update(assetId, (asset) => {
      const sourceText = { ...asset.sourceText, ...validatedInput };
      const decision = asset.recognition.normalizedResult
        ? makeEnrichmentDecision(asset.recognition.normalizedResult, sourceText, this.#threshold)
        : { celebrities: asset.celebrities, designers: asset.designers };
      const isSearchReady = decision.celebrities.some(
        (celebrity) => celebrity.searchDecision === "Accepted",
      );

      return {
        ...asset,
        ...decision,
        enrichmentState: {
          ...asset.enrichmentState,
          editorialMetadataProcessed: true,
          searchReady: asset.enrichmentState.imageRecognitionComplete && isSearchReady,
        },
        sourceText,
        updatedAt: new Date().toISOString(),
      };
    });
  }
}

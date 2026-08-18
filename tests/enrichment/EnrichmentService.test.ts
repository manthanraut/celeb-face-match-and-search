import { describe, expect, it, vi } from "vitest";

import { EnrichmentService } from "../../server/modules/enrichment/EnrichmentService.js";
import type { AssetRecord, AssetRepository } from "../../server/repositories/AssetRepository.js";
import type { CelebrityRepository } from "../../server/repositories/CelebrityRepository.js";
import type { EnrichmentRepository } from "../../server/repositories/EnrichmentRepository.js";

const ASSET_ID = "64b000000000000000000001";
const NOW = new Date("2027-05-04T12:00:00.000Z");

function createAsset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: ASSET_ID,
    createdAt: NOW,
    enrichment: { associations: [], searchReady: false },
    ingest: {
      clientAssetId: "11111111-1111-4111-8111-111111111111",
      originalFilename: "arrival.jpg",
    },
    recognition: {
      attemptNumber: 1,
      availableAt: NOW,
      normalizedResult: {
        faces: [
          {
            boundingBox: null,
            candidateName: "Rihanna",
            confidence: 50.4,
            confidenceKind: "provider-score",
            providerPersonId: "aws-rihanna",
            recognitionStatus: "recognized",
          },
        ],
        model: "RecognizeCelebrities",
        provider: "aws-rekognition",
        schemaVersion: "1.0",
        unrecognizedFaceCount: 0,
        warnings: [],
      },
      provider: "aws-rekognition",
      queuedAt: NOW,
      revision: 2,
      status: "SUCCEEDED",
    },
    sourceText: {
      altText: "A red carpet arrival",
      caption: "A guest arrives",
      revision: 1,
      title: "Met Gala arrival",
      updatedAt: NOW,
    },
    storage: {
      checksumSha256: "a".repeat(64),
      key: "stored/arrival.jpg",
      mimeType: "image/jpeg",
      provider: "local",
      sizeBytes: 100,
    },
    updatedAt: NOW,
    ...overrides,
  };
}

function createHarness(initialAsset: AssetRecord | null = createAsset()) {
  const assetRepository: AssetRepository = {
    findByClientAssetIds: vi.fn(async () => new Map()),
    findById: vi.fn(async () => initialAsset),
    insert: vi.fn(async (asset) => ({ id: ASSET_ID, ...asset })),
    list: vi.fn(async () => ({ assets: [], hasMore: false })),
    retryRecognition: vi.fn(async () => ({ outcome: "REQUEUED" as const })),
  };
  const celebrityRepository: CelebrityRepository = {
    list: vi.fn(async () => [
      {
        displayName: "Rihanna",
        normalizedAliases: ["robyn rihanna fenty"],
        normalizedName: "rihanna",
        providerIdentities: [
          { personId: "aws-rihanna", provider: "aws-rekognition" as const },
        ],
        slug: "rihanna",
      },
    ]),
  };
  const enrichmentRepository: EnrichmentRepository = {
    applyEnrichment: vi.fn(async () => true),
    findPendingEnrichmentAsset: vi.fn(async () => null),
    saveMetadataAndEnrichment: vi.fn(async (input) =>
      initialAsset
        ? {
            ...initialAsset,
            enrichment: input.enrichment,
            sourceText: input.sourceText,
            updatedAt: input.updatedAt,
          }
        : null,
    ),
  };
  const service = new EnrichmentService({
    approvalThreshold: 90,
    assetRepository,
    celebrityRepository,
    clock: () => NOW,
    enrichmentRepository,
  });

  return { assetRepository, celebrityRepository, enrichmentRepository, service };
}

describe("EnrichmentService", () => {
  it("evaluates completed recognition and writes revision-bound enrichment", async () => {
    const { enrichmentRepository, service } = createHarness();

    await expect(service.evaluateAsset(ASSET_ID)).resolves.toBe(true);

    expect(enrichmentRepository.applyEnrichment).toHaveBeenCalledWith({
      assetId: ASSET_ID,
      enrichment: {
        associations: [
          expect.objectContaining({
            decision: "NEEDS_REVIEW",
            displayName: "Rihanna",
          }),
        ],
        decisionEngineVersion: 1,
        evaluatedAt: NOW,
        recognitionRevision: 2,
        searchReady: false,
        sourceTextRevision: 1,
      },
      expectedRecognitionRevision: 2,
      expectedRecognitionStatus: "SUCCEEDED",
      expectedSourceTextRevision: 1,
      updatedAt: NOW,
    });
  });

  it("atomically saves metadata and recalculates a decision without recognition", async () => {
    const { enrichmentRepository, service } = createHarness();

    const updated = await service.updateMetadata(ASSET_ID, {
      title: "  Rihanna in Marc Jacobs  ",
    });

    expect(updated.sourceText).toEqual({
      altText: "A red carpet arrival",
      caption: "A guest arrives",
      revision: 2,
      title: "Rihanna in Marc Jacobs",
      updatedAt: NOW,
    });
    expect(updated.enrichment).toMatchObject({
      associations: [
        expect.objectContaining({
          decision: "APPROVED",
          evidenceFields: ["title"],
        }),
      ],
      recognitionRevision: 2,
      searchReady: true,
      sourceTextRevision: 2,
    });
    expect(enrichmentRepository.saveMetadataAndEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRecognitionRevision: 2,
        expectedRecognitionStatus: "SUCCEEDED",
        expectedSourceTextRevision: 1,
      }),
    );
  });

  it("does not infer metadata or query the catalog before recognition succeeds", async () => {
    const queued = createAsset({
      recognition: {
        attemptNumber: 0,
        availableAt: NOW,
        provider: "aws-rekognition",
        queuedAt: NOW,
        revision: 1,
        status: "QUEUED",
      },
    });
    const { celebrityRepository, service } = createHarness(queued);

    const updated = await service.updateMetadata(ASSET_ID, {
      caption: "Rihanna in Marc Jacobs",
    });

    expect(updated.enrichment).toMatchObject({ associations: [], searchReady: false });
    expect(celebrityRepository.list).not.toHaveBeenCalled();
  });

  it("retries an optimistic conflict against the latest recognition snapshot", async () => {
    const first = createAsset();
    const second = createAsset({
      recognition: { ...first.recognition, revision: 3 },
      sourceText: { ...first.sourceText, revision: 2 },
    });
    const { assetRepository, enrichmentRepository, service } = createHarness(first);
    vi.mocked(assetRepository.findById).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    vi.mocked(enrichmentRepository.saveMetadataAndEnrichment)
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async (input) => ({
        ...second,
        enrichment: input.enrichment,
        sourceText: input.sourceText,
      }));

    await service.updateMetadata(ASSET_ID, { title: "Rihanna at the Met Gala" });

    expect(enrichmentRepository.saveMetadataAndEnrichment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        expectedRecognitionRevision: 3,
        expectedSourceTextRevision: 2,
        sourceText: expect.objectContaining({ revision: 3 }),
      }),
    );
  });

  it("returns a safe missing-asset error", async () => {
    const { service } = createHarness(null);

    await expect(service.updateMetadata(ASSET_ID, { title: "Rihanna" })).rejects.toMatchObject({
      code: "ASSET_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("reconciles one pending completed asset", async () => {
    const asset = createAsset();
    const { enrichmentRepository, service } = createHarness(asset);
    vi.mocked(enrichmentRepository.findPendingEnrichmentAsset).mockResolvedValue(asset);

    await expect(service.evaluateNextPending()).resolves.toBe(true);

    expect(enrichmentRepository.findPendingEnrichmentAsset).toHaveBeenCalledWith(1);
    expect(enrichmentRepository.applyEnrichment).toHaveBeenCalledTimes(1);
  });
});

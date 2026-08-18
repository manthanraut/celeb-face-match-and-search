import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import {
  RecognitionWorker,
  type RecognitionWorkerDependencies,
} from "../../server/modules/recognition/RecognitionWorker.js";
import {
  type RecognitionInput,
  type RecognitionProvider,
  RecognitionProviderError,
} from "../../server/modules/recognition/RecognitionProvider.js";
import type {
  RecognitionJob,
  RecognitionJobRepository,
} from "../../server/repositories/RecognitionJobRepository.js";
import type { ImageStorage } from "../../server/storage/ImageStorage.js";
import type { RecognitionResult } from "../../shared/contracts/recognition.js";

const NOW = new Date("2027-05-04T12:00:00.000Z");
const IMAGE = Buffer.from("stored-image");
const JOB: RecognitionJob = {
  assetId: "64b000000000000000000001",
  attemptNumber: 1,
  expectedSizeBytes: IMAGE.length,
  leaseToken: "lease-token",
  mimeType: "image/jpeg",
  recognitionRevision: 1,
  storageKey: "stored/image.jpg",
};
const NORMALIZED_RESULT: RecognitionResult = {
  faces: [
    {
      boundingBox: { height: 0.3, left: 0.1, top: 0.1, width: 0.2 },
      candidateName: "Rihanna",
      confidence: 98,
      confidenceKind: "provider-score",
      providerPersonId: "person-1",
      recognitionStatus: "recognized",
    },
  ],
  model: "test-model",
  provider: "fake",
  schemaVersion: "1.0",
  unrecognizedFaceCount: 0,
  warnings: [],
};

function createHarness(options: {
  job?: RecognitionJob | null;
  openedSizeBytes?: number;
  provider?: RecognitionProvider;
} = {}) {
  const repository: RecognitionJobRepository = {
    claimRecognitionJob: vi.fn(async () => options.job === undefined ? JOB : options.job),
    completeRecognitionJob: vi.fn(async () => true),
    failRecognitionJob: vi.fn(async () => true),
    recoverExpiredRecognitionJobs: vi.fn(async () => ({
      indeterminateCount: 0,
      requeuedCount: 0,
    })),
    releaseRecognitionJob: vi.fn(async () => true),
  };
  const storage: ImageStorage = {
    delete: vi.fn(async () => undefined),
    initialize: vi.fn(async () => undefined),
    open: vi.fn(async () => ({
      sizeBytes: options.openedSizeBytes ?? IMAGE.length,
      stream: Readable.from(IMAGE),
    })),
    write: vi.fn(async () => "unused"),
  };
  const provider: RecognitionProvider = options.provider ?? {
    name: "fake",
    recognize: vi.fn(async () => ({
      normalizedResult: NORMALIZED_RESULT,
      rawResult: { providerPayload: true },
    })),
  };
  const dependencies: RecognitionWorkerDependencies = {
    clock: () => NOW,
    options: {
      leaseDurationMs: 30_000,
      maxAttempts: 3,
      pollIntervalMs: 5,
      requestTimeoutMs: 15_000,
      retryBaseDelayMs: 1_000,
      workerId: "test-worker",
    },
    provider,
    repository,
    storage,
  };

  return { provider, repository, storage, worker: new RecognitionWorker(dependencies) };
}

describe("RecognitionWorker", () => {
  it("recovers leases, atomically claims due work, and persists both result forms", async () => {
    const { provider, repository, worker } = createHarness();

    await expect(worker.runOnce()).resolves.toBe(true);

    expect(repository.recoverExpiredRecognitionJobs).toHaveBeenCalledWith(NOW, 3);
    expect(repository.claimRecognitionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseDurationMs: 30_000,
        maxAttempts: 3,
        now: NOW,
        providerName: "fake",
        workerId: "test-worker",
      }),
    );
    expect(provider.recognize).toHaveBeenCalledWith(
      expect.objectContaining({ image: IMAGE, mimeType: "image/jpeg" }),
    );
    expect(repository.completeRecognitionJob).toHaveBeenCalledWith(
      JOB,
      {
        normalizedResult: NORMALIZED_RESULT,
        rawResult: { providerPayload: true },
      },
      NOW,
    );
    expect(repository.failRecognitionJob).not.toHaveBeenCalled();
  });

  it("backs off a retryable provider error before the final attempt", async () => {
    const provider: RecognitionProvider = {
      name: "fake",
      recognize: vi.fn(async () => {
        throw new RecognitionProviderError(
          "RECOGNITION_PROVIDER_UNAVAILABLE",
          "The provider is temporarily unavailable.",
          true,
        );
      }),
    };
    const { repository, worker } = createHarness({ provider });

    await worker.runOnce();

    expect(repository.failRecognitionJob).toHaveBeenCalledWith(
      JOB,
      {
        availableAt: new Date(NOW.getTime() + 1_000),
        error: {
          code: "RECOGNITION_PROVIDER_UNAVAILABLE",
          message: "The provider is temporarily unavailable.",
          retryable: true,
        },
        status: "QUEUED",
      },
      NOW,
    );
  });

  it("moves the final retryable attempt to FAILED", async () => {
    const provider: RecognitionProvider = {
      name: "fake",
      recognize: vi.fn(async () => {
        throw new RecognitionProviderError(
          "RECOGNITION_PROVIDER_UNAVAILABLE",
          "The provider is temporarily unavailable.",
          true,
        );
      }),
    };
    const finalJob = { ...JOB, attemptNumber: 3 };
    const { repository, worker } = createHarness({ job: finalJob, provider });

    await worker.runOnce();

    expect(repository.failRecognitionJob).toHaveBeenCalledWith(
      finalJob,
      expect.objectContaining({ status: "FAILED" }),
      NOW,
    );
  });

  it("marks unexpected outcomes indeterminate without exposing their details", async () => {
    const provider: RecognitionProvider = {
      name: "fake",
      recognize: vi.fn(async () => {
        throw new Error("sensitive internal failure");
      }),
    };
    const { repository, worker } = createHarness({ provider });

    await worker.runOnce();

    expect(repository.failRecognitionJob).toHaveBeenCalledWith(
      JOB,
      {
        error: {
          code: "RECOGNITION_OUTCOME_UNKNOWN",
          message: "Recognition stopped with an unexpected result and requires review.",
          retryable: false,
        },
        status: "INDETERMINATE",
      },
      NOW,
    );
  });

  it("fails corrupted stored-image metadata without calling the provider", async () => {
    const { provider, repository, worker } = createHarness({ openedSizeBytes: IMAGE.length + 1 });

    await worker.runOnce();

    expect(provider.recognize).not.toHaveBeenCalled();
    expect(repository.failRecognitionJob).toHaveBeenCalledWith(
      JOB,
      expect.objectContaining({
        error: expect.objectContaining({ code: "ASSET_IMAGE_SIZE_MISMATCH", retryable: false }),
        status: "FAILED",
      }),
      NOW,
    );
  });

  it("releases active work without consuming an attempt during shutdown", async () => {
    const close = vi.fn();
    const provider: RecognitionProvider = {
      close,
      name: "fake",
      recognize: vi.fn(
        ({ signal }: RecognitionInput) =>
          new Promise<never>((_, reject) => {
            signal?.addEventListener("abort", () => {
              reject(
                new RecognitionProviderError(
                  "RECOGNITION_REQUEST_ABORTED",
                  "The recognition request was interrupted.",
                  true,
                ),
              );
            });
          }),
      ),
    };
    const { repository, worker } = createHarness({ provider });

    worker.start();
    await vi.waitFor(() => expect(provider.recognize).toHaveBeenCalledTimes(1));
    await worker.stop();

    expect(repository.releaseRecognitionJob).toHaveBeenCalledWith(JOB, NOW);
    expect(repository.failRecognitionJob).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not claim a job when no due work exists", async () => {
    const { provider, repository, worker } = createHarness({ job: null });

    await expect(worker.runOnce()).resolves.toBe(false);

    expect(provider.recognize).not.toHaveBeenCalled();
    expect(repository.completeRecognitionJob).not.toHaveBeenCalled();
  });
});

import { randomUUID } from "node:crypto";

import { MAX_ASSET_UPLOAD_FILE_SIZE_BYTES } from "../../../shared/assets.js";
import { recognitionResultSchema } from "../../../shared/contracts/recognition.js";
import type {
  RecognitionJob,
  RecognitionJobFailure,
  RecognitionJobRepository,
} from "../../repositories/RecognitionJobRepository.js";
import type { ImageStorage } from "../../storage/ImageStorage.js";
import {
  type RecognitionProvider,
  RecognitionProviderError,
} from "./RecognitionProvider.js";

export interface RecognitionWorkerOptions {
  leaseDurationMs: number;
  maxAttempts: number;
  pollIntervalMs: number;
  requestTimeoutMs: number;
  retryBaseDelayMs: number;
  workerId: string;
}

export interface RecognitionWorkerDependencies {
  clock?: () => Date;
  logger?: Pick<Console, "error">;
  options?: Partial<RecognitionWorkerOptions>;
  provider: RecognitionProvider;
  repository: RecognitionJobRepository;
  storage: ImageStorage;
}

export const defaultRecognitionWorkerOptions: RecognitionWorkerOptions = {
  leaseDurationMs: 30_000,
  maxAttempts: 3,
  pollIntervalMs: 500,
  requestTimeoutMs: 15_000,
  retryBaseDelayMs: 1_000,
  workerId: `recognition-worker-${process.pid}`,
};

class RecognitionInputError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RecognitionInputError";
    this.code = code;
  }
}

export class RecognitionWorker {
  readonly #clock: () => Date;
  readonly #logger: Pick<Console, "error">;
  readonly #options: RecognitionWorkerOptions;
  readonly #provider: RecognitionProvider;
  readonly #repository: RecognitionJobRepository;
  readonly #storage: ImageStorage;
  #activeRequest: AbortController | null = null;
  #closed = false;
  #loopPromise: Promise<void> | null = null;
  #stopping = false;
  #wake: (() => void) | null = null;

  constructor({
    clock = () => new Date(),
    logger = console,
    options = {},
    provider,
    repository,
    storage,
  }: RecognitionWorkerDependencies) {
    this.#clock = clock;
    this.#logger = logger;
    this.#options = { ...defaultRecognitionWorkerOptions, ...options };
    this.#provider = provider;
    this.#repository = repository;
    this.#storage = storage;

    if (this.#options.requestTimeoutMs >= this.#options.leaseDurationMs) {
      throw new Error("Recognition request timeout must be shorter than the lease duration.");
    }
    if (this.#options.maxAttempts < 1) {
      throw new Error("Recognition max attempts must be at least one.");
    }
  }

  start(): void {
    if (this.#closed) {
      throw new Error("A stopped recognition worker cannot be restarted.");
    }
    if (this.#loopPromise) {
      return;
    }

    this.#stopping = false;
    this.#loopPromise = this.#runLoop();
  }

  async stop(): Promise<void> {
    if (this.#closed) {
      return;
    }

    this.#stopping = true;
    this.#activeRequest?.abort();
    this.#wake?.();
    await this.#loopPromise;
    this.#provider.close?.();
    this.#closed = true;
  }

  async runOnce(): Promise<boolean> {
    const now = this.#clock();
    await this.#repository.recoverExpiredRecognitionJobs(now, this.#options.maxAttempts);
    const job = await this.#repository.claimRecognitionJob({
      leaseDurationMs: this.#options.leaseDurationMs,
      leaseToken: randomUUID(),
      maxAttempts: this.#options.maxAttempts,
      now,
      providerName: this.#provider.name,
      workerId: this.#options.workerId,
    });
    if (!job) {
      return false;
    }

    await this.#processJob(job);
    return true;
  }

  async #runLoop(): Promise<void> {
    while (!this.#stopping) {
      let processed = false;
      try {
        processed = await this.runOnce();
      } catch {
        if (!this.#stopping) {
          this.#logger.error("Recognition worker iteration failed.");
        }
      }

      if (!processed && !this.#stopping) {
        await this.#waitForWork();
      }
    }
  }

  async #processJob(job: RecognitionJob): Promise<void> {
    const abortController = new AbortController();
    this.#activeRequest = abortController;
    const timeout = setTimeout(() => abortController.abort(), this.#options.requestTimeoutMs);
    timeout.unref();

    try {
      const image = await this.#readImage(job);
      const response = await this.#provider.recognize({
        image,
        mimeType: job.mimeType,
        signal: abortController.signal,
      });
      const normalizedResult = recognitionResultSchema.parse(response.normalizedResult);
      await this.#repository.completeRecognitionJob(
        job,
        { normalizedResult, rawResult: response.rawResult },
        this.#clock(),
      );
    } catch (error) {
      if (this.#stopping) {
        await this.#repository.releaseRecognitionJob(job, this.#clock());
        return;
      }

      await this.#repository.failRecognitionJob(
        job,
        this.#failureFor(error, job),
        this.#clock(),
      );
    } finally {
      clearTimeout(timeout);
      if (this.#activeRequest === abortController) {
        this.#activeRequest = null;
      }
    }
  }

  #failureFor(error: unknown, job: RecognitionJob): RecognitionJobFailure {
    if (error instanceof RecognitionInputError) {
      return {
        error: { code: error.code, message: error.message, retryable: false },
        status: "FAILED",
      };
    }

    if (error instanceof RecognitionProviderError) {
      if (error.retryable && job.attemptNumber < this.#options.maxAttempts) {
        const retryDelay = Math.min(
          60_000,
          this.#options.retryBaseDelayMs * 2 ** Math.max(0, job.attemptNumber - 1),
        );
        return {
          availableAt: new Date(this.#clock().getTime() + retryDelay),
          error: { code: error.code, message: error.message, retryable: true },
          status: "QUEUED",
        };
      }

      return {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
        status: "FAILED",
      };
    }

    return {
      error: {
        code: "RECOGNITION_OUTCOME_UNKNOWN",
        message: "Recognition stopped with an unexpected result and requires review.",
        retryable: false,
      },
      status: "INDETERMINATE",
    };
  }

  async #readImage(job: RecognitionJob): Promise<Buffer> {
    let openedImage;
    try {
      openedImage = await this.#storage.open(job.storageKey);
    } catch (error) {
      throw new RecognitionInputError(
        "ASSET_IMAGE_UNAVAILABLE",
        "The stored asset image is unavailable.",
        { cause: error },
      );
    }

    if (
      openedImage.sizeBytes !== job.expectedSizeBytes ||
      openedImage.sizeBytes > MAX_ASSET_UPLOAD_FILE_SIZE_BYTES
    ) {
      openedImage.stream.destroy();
      throw new RecognitionInputError(
        "ASSET_IMAGE_SIZE_MISMATCH",
        "The stored asset image size does not match its metadata.",
      );
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    try {
      for await (const chunk of openedImage.stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > job.expectedSizeBytes) {
          throw new RecognitionInputError(
            "ASSET_IMAGE_SIZE_MISMATCH",
            "The stored asset image size does not match its metadata.",
          );
        }
        chunks.push(buffer);
      }
    } catch (error) {
      openedImage.stream.destroy();
      if (error instanceof RecognitionInputError) {
        throw error;
      }
      throw new RecognitionInputError(
        "ASSET_IMAGE_UNAVAILABLE",
        "The stored asset image could not be read.",
        { cause: error },
      );
    }

    if (totalBytes !== job.expectedSizeBytes) {
      throw new RecognitionInputError(
        "ASSET_IMAGE_SIZE_MISMATCH",
        "The stored asset image size does not match its metadata.",
      );
    }

    return Buffer.concat(chunks, totalBytes);
  }

  #waitForWork(): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, this.#options.pollIntervalMs);
      timer.unref();
      this.#wake = () => {
        clearTimeout(timer);
        resolve();
      };
    }).finally(() => {
      this.#wake = null;
    });
  }
}

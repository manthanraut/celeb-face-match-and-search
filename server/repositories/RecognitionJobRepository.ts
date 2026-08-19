import type { AssetImageMimeType } from "../../shared/assets.js";
import type {
  RecognitionProviderName,
  RecognitionResult,
} from "../../shared/contracts/recognition.js";

export interface RecognitionJob {
  assetId: string;
  attemptNumber: number;
  expectedSizeBytes: number;
  leaseToken: string;
  mimeType: AssetImageMimeType;
  recognitionRevision: number;
  storageKey: string;
}

export interface ClaimRecognitionJobOptions {
  leaseDurationMs: number;
  leaseToken: string;
  maxAttempts: number;
  now: Date;
  providerName: RecognitionProviderName;
  workerId: string;
}

export interface RecognitionJobFailure {
  availableAt?: Date;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  status: "QUEUED" | "FAILED" | "INDETERMINATE";
}

export interface RecognitionLeaseRecoveryResult {
  indeterminateCount: number;
  requeuedCount: number;
}

export interface RecognitionJobRepository {
  claimRecognitionJob(options: ClaimRecognitionJobOptions): Promise<RecognitionJob | null>;
  completeRecognitionJob(
    job: RecognitionJob,
    result: { normalizedResult: RecognitionResult; rawResult: unknown },
    now: Date,
  ): Promise<boolean>;
  failRecognitionJob(
    job: RecognitionJob,
    failure: RecognitionJobFailure,
    now: Date,
  ): Promise<boolean>;
  recoverExpiredRecognitionJobs(
    now: Date,
    maxAttempts: number,
  ): Promise<RecognitionLeaseRecoveryResult>;
  releaseRecognitionJob(job: RecognitionJob, now: Date): Promise<boolean>;
}

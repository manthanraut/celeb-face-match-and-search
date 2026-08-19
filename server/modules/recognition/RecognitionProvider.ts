import type {
  RecognitionProviderName,
  RecognitionResult,
} from "../../../shared/contracts/recognition.js";

export interface RecognitionInput {
  image: Buffer;
  mimeType: string;
  signal?: AbortSignal;
}

export interface RecognitionProviderResponse {
  normalizedResult: RecognitionResult;
  rawResult: unknown;
}

export interface RecognitionProvider {
  readonly name: RecognitionProviderName;
  close?(): void;
  recognize(input: RecognitionInput): Promise<RecognitionProviderResponse>;
}

export class RecognitionProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "RecognitionProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

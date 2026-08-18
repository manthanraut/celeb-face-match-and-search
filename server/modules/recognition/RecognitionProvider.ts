import type { RecognitionResult } from "../../../shared/contracts/recognition.js";

export interface RecognitionInput {
  image: Buffer;
  mimeType: string;
}

export interface RecognitionProviderResponse {
  normalizedResult: RecognitionResult;
  rawResponse: unknown;
}

export interface RecognitionProvider {
  readonly name: "aws-rekognition";
  recognize(input: RecognitionInput): Promise<RecognitionProviderResponse>;
}

import {
  RekognitionClient,
  RecognizeCelebritiesCommand,
  type BoundingBox,
  type RecognizeCelebritiesCommandOutput,
} from "@aws-sdk/client-rekognition";

import {
  recognitionResultSchema,
  type RecognitionResult,
} from "../../../shared/contracts/recognition.js";
import {
  type RecognitionInput,
  type RecognitionProvider,
  RecognitionProviderError,
  type RecognitionProviderResponse,
} from "./RecognitionProvider.js";

interface RekognitionClientLike {
  destroy(): void;
  send(
    command: RecognizeCelebritiesCommand,
    options?: { abortSignal?: AbortSignal },
  ): Promise<RecognizeCelebritiesCommandOutput>;
}

export interface AwsRekognitionProviderOptions {
  client?: RekognitionClientLike;
  region: string;
}

const RETRYABLE_ERROR_NAMES = new Set([
  "InternalServerError",
  "LimitExceededException",
  "NetworkingError",
  "ProvisionedThroughputExceededException",
  "RequestTimeout",
  "ServiceUnavailable",
  "ThrottlingException",
  "TimeoutError",
]);
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
]);

export class AwsRekognitionProvider implements RecognitionProvider {
  readonly name = "aws-rekognition" as const;
  readonly #client: RekognitionClientLike;

  constructor({ client, region }: AwsRekognitionProviderOptions) {
    this.#client = client ?? new RekognitionClient({ region });
  }

  close(): void {
    this.#client.destroy();
  }

  async recognize(input: RecognitionInput): Promise<RecognitionProviderResponse> {
    if (input.mimeType !== "image/jpeg" && input.mimeType !== "image/png") {
      throw new RecognitionProviderError(
        "UNSUPPORTED_IMAGE_TYPE",
        "Recognition supports only JPEG and PNG images.",
        false,
      );
    }

    let output: RecognizeCelebritiesCommandOutput;
    try {
      output = await this.#client.send(
        new RecognizeCelebritiesCommand({ Image: { Bytes: input.image } }),
        input.signal ? { abortSignal: input.signal } : undefined,
      );
    } catch (error) {
      throw toProviderError(error);
    }

    const { $metadata: _metadata, ...rawResult } = output;
    return {
      normalizedResult: normalizeResult(output),
      rawResult,
    };
  }
}

function normalizeResult(output: RecognizeCelebritiesCommandOutput): RecognitionResult {
  const warnings: string[] = [];
  const faces = (output.CelebrityFaces ?? []).map((celebrity, index) => {
    const candidateName = normalizeText(celebrity.Name);
    const providerPersonId = normalizeText(celebrity.Id);
    const confidence = normalizeConfidence(celebrity.MatchConfidence);
    const boundingBox = normalizeBoundingBox(celebrity.Face?.BoundingBox, warnings, index);

    if (!candidateName) {
      warnings.push(`Celebrity face ${index + 1} did not include a name.`);
    }
    if (!providerPersonId) {
      warnings.push(`Celebrity face ${index + 1} did not include a provider ID.`);
    }
    if (confidence === null) {
      warnings.push(`Celebrity face ${index + 1} did not include match confidence.`);
    }

    return {
      boundingBox,
      candidateName,
      confidence,
      confidenceKind: "provider-score" as const,
      providerPersonId,
      recognitionStatus: candidateName
        ? confidence === null
          ? ("uncertain" as const)
          : ("recognized" as const)
        : ("unknown" as const),
    };
  });

  return recognitionResultSchema.parse({
    faces,
    model: "RecognizeCelebrities",
    provider: "aws-rekognition",
    schemaVersion: "1.0",
    unrecognizedFaceCount: output.UnrecognizedFaces?.length ?? 0,
    warnings,
  });
}

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeConfidence(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : null;
}

function normalizeBoundingBox(
  value: BoundingBox | undefined,
  warnings: string[],
  faceIndex: number,
) {
  const coordinates = [value?.Left, value?.Top, value?.Width, value?.Height];
  if (!coordinates.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))) {
    warnings.push(`Celebrity face ${faceIndex + 1} did not include a complete bounding box.`);
    return null;
  }

  const [left, top, width, height] = coordinates as [number, number, number, number];
  const clamped = [left, top, width, height].some((coordinate) => coordinate < 0 || coordinate > 1);
  if (clamped) {
    warnings.push(`Celebrity face ${faceIndex + 1} bounding box was clamped to the image bounds.`);
  }

  return {
    height: Math.min(1, Math.max(0, height)),
    left: Math.min(1, Math.max(0, left)),
    top: Math.min(1, Math.max(0, top)),
    width: Math.min(1, Math.max(0, width)),
  };
}

function toProviderError(error: unknown): RecognitionProviderError {
  const name = error instanceof Error ? error.name : "UnknownError";
  if (name === "AbortError") {
    return new RecognitionProviderError(
      "RECOGNITION_REQUEST_ABORTED",
      "The recognition request was interrupted.",
      true,
      { cause: error },
    );
  }

  const metadata = hasObjectProperty(error, "$metadata") ? error.$metadata : undefined;
  const statusCode = hasObjectProperty(metadata, "httpStatusCode")
    ? metadata.httpStatusCode
    : undefined;
  const networkCode = hasObjectProperty(error, "code") ? error.code : undefined;
  const retryable =
    RETRYABLE_ERROR_NAMES.has(name) ||
    (typeof networkCode === "string" && RETRYABLE_NETWORK_CODES.has(networkCode)) ||
    (typeof statusCode === "number" && (statusCode === 429 || statusCode >= 500));

  if (name === "InvalidImageFormatException") {
    return new RecognitionProviderError(
      "INVALID_IMAGE",
      "Amazon Rekognition could not decode the image.",
      false,
      { cause: error },
    );
  }
  if (name === "ImageTooLargeException") {
    return new RecognitionProviderError(
      "IMAGE_TOO_LARGE",
      "The image exceeds the recognition provider limit.",
      false,
      { cause: error },
    );
  }
  if (name === "AccessDeniedException" || name === "UnrecognizedClientException") {
    return new RecognitionProviderError(
      "RECOGNITION_ACCESS_DENIED",
      "Amazon Rekognition credentials or permissions are invalid.",
      false,
      { cause: error },
    );
  }

  return new RecognitionProviderError(
    retryable ? "RECOGNITION_PROVIDER_UNAVAILABLE" : "RECOGNITION_PROVIDER_REJECTED",
    retryable
      ? "The recognition provider is temporarily unavailable."
      : "The recognition provider rejected the request.",
    retryable,
    { cause: error },
  );
}

function hasObjectProperty(
  value: unknown,
  property: string,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && property in value;
}

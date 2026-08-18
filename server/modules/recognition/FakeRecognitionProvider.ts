import { createHash } from "node:crypto";

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

const CELEBRITIES = [
  { displayName: "Rihanna", providerPersonId: "fake-rihanna" },
  { displayName: "Zendaya", providerPersonId: "fake-zendaya" },
  { displayName: "A$AP Rocky", providerPersonId: "fake-asap-rocky" },
  { displayName: "Anya Taylor-Joy", providerPersonId: "fake-anya-taylor-joy" },
] as const;

export class FakeRecognitionProvider implements RecognitionProvider {
  readonly name = "fake" as const;

  async recognize(input: RecognitionInput): Promise<RecognitionProviderResponse> {
    if (input.signal?.aborted) {
      throw new RecognitionProviderError(
        "RECOGNITION_REQUEST_ABORTED",
        "The recognition request was interrupted.",
        true,
      );
    }
    if (input.image.length === 0) {
      throw new RecognitionProviderError(
        "INVALID_IMAGE",
        "The image does not contain data.",
        false,
      );
    }

    const checksum = createHash("sha256").update(input.image).digest();
    const faceCount = 1 + (checksum[0] % 2);
    const faces = Array.from({ length: faceCount }, (_, index) => {
      const celebrity = CELEBRITIES[(checksum[index + 1] + index) % CELEBRITIES.length];
      const confidence = 90 + (checksum[index + 4] % 1_000) / 100;
      return {
        boundingBox: {
          height: 0.3,
          left: Number((0.1 + index * 0.4).toFixed(2)),
          top: 0.15,
          width: 0.25,
        },
        candidateName: celebrity.displayName,
        confidence: Math.min(99.99, confidence),
        confidenceKind: "provider-score" as const,
        providerPersonId: celebrity.providerPersonId,
        recognitionStatus: "recognized" as const,
      };
    });
    const normalizedResult: RecognitionResult = recognitionResultSchema.parse({
      faces,
      model: "deterministic-fake-v1",
      provider: "fake",
      schemaVersion: "1.0",
      unrecognizedFaceCount: checksum[3] % 2,
      warnings: [],
    });

    return {
      normalizedResult,
      rawResult: {
        checksumSha256: checksum.toString("hex"),
        faces,
        unrecognizedFaceCount: normalizedResult.unrecognizedFaceCount,
      },
    };
  }
}

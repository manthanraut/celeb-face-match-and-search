import {
  RecognizeCelebritiesCommand,
  RekognitionClient,
  type BoundingBox,
} from "@aws-sdk/client-rekognition";

import type { RecognitionResult } from "../../../shared/contracts/recognition.js";
import type {
  RecognitionInput,
  RecognitionProvider,
  RecognitionProviderResponse,
} from "./RecognitionProvider.js";

const MODEL_NAME = "AWS RecognizeCelebrities";

function bounded(value: number | undefined) {
  return Math.min(1, Math.max(0, value ?? 0));
}

function normalizeBoundingBox(box: BoundingBox | undefined) {
  if (!box) {
    return null;
  }

  return {
    height: bounded(box.Height),
    left: bounded(box.Left),
    top: bounded(box.Top),
    width: bounded(box.Width),
  };
}

export class AwsRekognitionProvider implements RecognitionProvider {
  readonly name = "aws-rekognition" as const;
  readonly #client: RekognitionClient;

  constructor(region: string) {
    this.#client = new RekognitionClient({ region });
  }

  async recognize(input: RecognitionInput): Promise<RecognitionProviderResponse> {
    if (input.mimeType !== "image/jpeg" && input.mimeType !== "image/png") {
      throw new Error("AWS Rekognition celebrity recognition accepts JPEG or PNG images.");
    }

    const rawResponse = await this.#client.send(
      new RecognizeCelebritiesCommand({ Image: { Bytes: input.image } }),
    );

    const normalizedResult: RecognitionResult = {
      faces: (rawResponse.CelebrityFaces ?? []).map((celebrity) => ({
        boundingBox: normalizeBoundingBox(celebrity.Face?.BoundingBox),
        candidateName: celebrity.Name?.trim() || null,
        confidence: celebrity.MatchConfidence ?? null,
        confidenceKind: "provider-score",
        providerPersonId: celebrity.Id?.trim() || null,
        recognitionStatus: celebrity.Name ? "recognized" : "unknown",
      })),
      model: MODEL_NAME,
      provider: "aws-rekognition",
      schemaVersion: "1.0",
      unrecognizedFaceCount: rawResponse.UnrecognizedFaces?.length ?? 0,
      warnings: [],
    };

    return { normalizedResult, rawResponse };
  }
}

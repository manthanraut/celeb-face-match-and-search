import {
  type RecognizeCelebritiesCommand,
  type RecognizeCelebritiesCommandOutput,
} from "@aws-sdk/client-rekognition";
import { describe, expect, it, vi } from "vitest";

import { AwsRekognitionProvider } from "../../server/modules/recognition/AwsRekognitionProvider.js";
import { FakeRecognitionProvider } from "../../server/modules/recognition/FakeRecognitionProvider.js";
import { RecognitionProviderError } from "../../server/modules/recognition/RecognitionProvider.js";
import { recognitionResultSchema } from "../../shared/contracts/recognition.js";

function createAwsClient(output: RecognizeCelebritiesCommandOutput) {
  return {
    destroy: vi.fn(),
    send: vi.fn(async (_command: RecognizeCelebritiesCommand) => output),
  };
}

describe("AwsRekognitionProvider", () => {
  it("normalizes every face and keeps provider output separate", async () => {
    const client = createAwsClient({
      $metadata: { httpStatusCode: 200, requestId: "private-request-id" },
      CelebrityFaces: [
        {
          Face: { BoundingBox: { Height: 0.4, Left: -0.1, Top: 0.2, Width: 1.2 } },
          Id: "person-1",
          MatchConfidence: 98.75,
          Name: " Rihanna ",
        },
        {
          Face: {},
          MatchConfidence: 88,
        },
      ],
      UnrecognizedFaces: [{ BoundingBox: { Height: 0.1, Left: 0.1, Top: 0.1, Width: 0.1 } }],
    });
    const provider = new AwsRekognitionProvider({ client, region: "us-east-1" });
    const image = Buffer.from("image-bytes");

    const response = await provider.recognize({ image, mimeType: "image/jpeg" });

    expect(recognitionResultSchema.parse(response.normalizedResult)).toEqual(
      expect.objectContaining({
        faces: [
          expect.objectContaining({
            boundingBox: { height: 0.4, left: 0, top: 0.2, width: 1 },
            candidateName: "Rihanna",
            confidence: 98.75,
            providerPersonId: "person-1",
            recognitionStatus: "recognized",
          }),
          expect.objectContaining({
            boundingBox: null,
            candidateName: null,
            confidence: 88,
            providerPersonId: null,
            recognitionStatus: "unknown",
          }),
        ],
        provider: "aws-rekognition",
        unrecognizedFaceCount: 1,
      }),
    );
    expect(response.normalizedResult.warnings).toHaveLength(4);
    expect(response.rawResult).not.toHaveProperty("$metadata");
    expect(response.rawResult).toHaveProperty("CelebrityFaces");
    expect(client.send.mock.calls[0]?.[0].input).toEqual({ Image: { Bytes: image } });

    provider.close();
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["InvalidImageFormatException", "INVALID_IMAGE", false],
    ["ThrottlingException", "RECOGNITION_PROVIDER_UNAVAILABLE", true],
    ["AccessDeniedException", "RECOGNITION_ACCESS_DENIED", false],
  ] as const)("maps %s to a safe provider error", async (name, code, retryable) => {
    const client = createAwsClient({ $metadata: {} });
    client.send.mockRejectedValueOnce(Object.assign(new Error("provider details"), { name }));
    const provider = new AwsRekognitionProvider({ client, region: "us-east-1" });

    const error = await provider
      .recognize({ image: Buffer.from("image"), mimeType: "image/png" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RecognitionProviderError);
    expect(error).toMatchObject({ code, retryable });
    expect((error as Error).message).not.toContain("provider details");
  });
});

describe("FakeRecognitionProvider", () => {
  it("returns deterministic, schema-valid multi-face output", async () => {
    const provider = new FakeRecognitionProvider();
    const input = { image: Buffer.from([0]), mimeType: "image/jpeg" as const };

    const first = await provider.recognize(input);
    const second = await provider.recognize(input);

    expect(first).toEqual(second);
    expect(recognitionResultSchema.parse(first.normalizedResult)).toEqual(first.normalizedResult);
    expect(first.normalizedResult.provider).toBe("fake");
    expect(first.normalizedResult.faces.length).toBeGreaterThanOrEqual(1);
    expect(first.rawResult).toHaveProperty("checksumSha256");
  });

  it("honors an already-aborted request", async () => {
    const abortController = new AbortController();
    abortController.abort();

    await expect(
      new FakeRecognitionProvider().recognize({
        image: Buffer.from("image"),
        mimeType: "image/png",
        signal: abortController.signal,
      }),
    ).rejects.toMatchObject({ code: "RECOGNITION_REQUEST_ABORTED", retryable: true });
  });
});

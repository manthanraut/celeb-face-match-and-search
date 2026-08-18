import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AssetsRepository } from "../assets/assets.repository.js";
import { AssetsService } from "../assets/assets.service.js";
import { LocalFileStorage } from "../../storage/LocalFileStorage.js";
import type { RecognitionProvider } from "./RecognitionProvider.js";
import { RecognitionRepository } from "./recognition.repository.js";
import { RecognitionWorker } from "./recognition.worker.js";

class FakeRecognitionProvider implements RecognitionProvider {
  readonly name = "aws-rekognition" as const;
  callCount = 0;

  async recognize() {
    this.callCount += 1;

    return {
      normalizedResult: {
        faces: [
          {
            boundingBox: { height: 0.4, left: 0.2, top: 0.1, width: 0.3 },
            candidateName: "Rihanna",
            confidence: 91.2,
            confidenceKind: "provider-score" as const,
            providerPersonId: "aws-person-1",
            recognitionStatus: "recognized" as const,
          },
          {
            boundingBox: { height: 0.2, left: 0.6, top: 0.2, width: 0.2 },
            candidateName: "Zendaya",
            confidence: 99.5,
            confidenceKind: "provider-score" as const,
            providerPersonId: "aws-person-2",
            recognitionStatus: "recognized" as const,
          },
        ],
        model: "AWS RecognizeCelebrities",
        provider: "aws-rekognition" as const,
        schemaVersion: "1.0" as const,
        unrecognizedFaceCount: 0,
        warnings: [],
      },
      rawResponse: {
        CelebrityFaces: [
          { Id: "aws-person-1", MatchConfidence: 91.2, Name: "Rihanna" },
          { Id: "aws-person-2", MatchConfidence: 99.5, Name: "Zendaya" },
        ],
      },
    };
  }
}

describe("recognition workflow", () => {
  it("keeps the uploaded asset, raw response, and recalculated decisions mapped by one asset ID", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "celebrity-recognition-"));

    try {
      const storage = new LocalFileStorage(directory);
      const assetsRepository = new AssetsRepository(storage);
      const recognitionRepository = new RecognitionRepository(storage);
      const provider = new FakeRecognitionProvider();
      const assetsService = new AssetsService(assetsRepository, recognitionRepository, storage, 99);
      const worker = new RecognitionWorker(
        assetsRepository,
        recognitionRepository,
        storage,
        provider,
        99,
      );
      const createdAsset = await assetsService.create({
        contents: Buffer.from("fake-jpeg"),
        fileName: "met-gala.jpg",
        height: 900,
        lastModified: 1_787_032_800_000,
        mimeType: "image/jpeg",
        width: 1600,
      });

      worker.enqueue(createdAsset.id);
      await worker.waitForIdle();

      const completed = await assetsService.get(createdAsset.id);
      expect(completed.asset.recognition.status).toBe("completed");
      expect(completed.asset.celebrities[0]).toMatchObject({
        canonicalName: "Rihanna",
        searchDecision: "Needs Review",
      });
      expect(completed.asset.celebrities[1]).toMatchObject({
        canonicalName: "Zendaya",
        searchDecision: "Accepted",
        status: "Approved",
      });
      expect(completed.asset.enrichmentState.searchReady).toBe(true);
      expect(completed.rawRecognitionResponse).toMatchObject({
        CelebrityFaces: [
          { Id: "aws-person-1" },
          { Id: "aws-person-2" },
        ],
      });

      await assetsService.updateSourceText(createdAsset.id, { caption: "Rihanna at the Met Gala" });
      const updated = await assetsService.get(createdAsset.id);
      expect(updated.asset.celebrities[0]).toMatchObject({
        editorialTextMatch: { matched: true, source: "caption" },
        searchDecision: "Accepted",
      });
      expect(provider.callCount).toBe(1);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

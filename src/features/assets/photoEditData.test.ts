import { describe, expect, it } from "vitest";

import type { AssetDetail } from "./contracts";
import { createPhotoCrops, createPhotoEditData } from "./photoEditData";

describe("photo edit data utilities", () => {
  it("maps the backend asset detail to editable photo data", () => {
    const asset = {
      assetId: "64b000000000000000000001",
      createdAt: "2027-05-04T12:00:00.000Z",
      enrichment: {
        associations: [],
        decisionEngineVersion: null,
        evaluatedAt: null,
        hideFromSearch: false,
        recognitionRevision: null,
        sourceTextRevision: null,
      },
      links: {
        admin: "/admin/photos/64b000000000000000000001",
        image: "/api/assets/64b000000000000000000001/image",
        self: "/api/assets/64b000000000000000000001",
      },
      mimeType: "image/jpeg",
      originalFilename: "red-carpet.jpg",
      recognition: {
        attemptNumber: 0,
        completedAt: null,
        lastError: null,
        provider: "aws-rekognition",
        result: null,
        revision: 1,
        status: "QUEUED",
      },
      recognitionStatus: "QUEUED",
      sizeBytes: 2_500_000,
      sourceText: {
        altText: null,
        backstory: null,
        caption: null,
        revision: 1,
        title: "red carpet",
      },
      updatedAt: "2027-05-04T12:00:00.000Z",
    } satisfies AssetDetail;

    expect(createPhotoEditData(asset, { height: 2160, width: 3840 })).toMatchObject({
      assetId: "64b000000000000000000001",
      height: 2160,
      name: "red-carpet.jpg",
      previewUrl: "/api/assets/64b000000000000000000001/image",
      size: 2_500_000,
      type: "image/jpeg",
      width: 3840,
    });
  });

  it("calculates crop dimensions inside the original image", () => {
    const crops = createPhotoCrops(3840, 2160);

    expect(crops.find((crop) => crop.label === "16:9")).toMatchObject({
      height: 2160,
      width: 3840,
    });
    expect(crops.find((crop) => crop.label === "1:1")).toMatchObject({
      height: 2160,
      width: 2160,
    });
    expect(crops.find((crop) => crop.label === "4:5")).toMatchObject({
      height: 2160,
      width: 1728,
    });
  });
});

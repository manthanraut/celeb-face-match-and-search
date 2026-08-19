import { describe, expect, it } from "vitest";

import { createPhotoCrops, readPhotoEditData } from "./photoEditData";

describe("photo edit data utilities", () => {
  it("reads uploaded photo metadata from search parameters", () => {
    const searchParams = new URLSearchParams({
      height: "2160",
      lastModified: "1787032800000",
      name: "red-carpet.jpg",
      previewUrl: "blob:http://localhost/photo-123",
      size: "2500000",
      type: "image/jpeg",
      width: "3840",
    });

    expect(readPhotoEditData(searchParams, "photo-123")).toMatchObject({
      assetId: "photo-123",
      height: 2160,
      name: "red-carpet.jpg",
      previewUrl: "blob:http://localhost/photo-123",
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

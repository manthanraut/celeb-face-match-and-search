import { afterEach, describe, expect, it, vi } from "vitest";

import { getPhotoAsset, uploadPhotoAssets } from "./api";

const assetSummary = {
  assetId: "64b000000000000000000001",
  created: true,
  createdAt: "2027-05-04T12:00:00.000Z",
  links: {
    admin: "/admin/photos/64b000000000000000000001",
    image: "/api/assets/64b000000000000000000001/image",
    self: "/api/assets/64b000000000000000000001",
  },
  mimeType: "image/jpeg",
  originalFilename: "rihanna-met-gala.jpg",
  recognitionStatus: "QUEUED",
  searchReady: false,
  sizeBytes: 4,
  sourceText: {
    altText: null,
    caption: null,
    revision: 1,
    title: "rihanna met gala",
  },
  updatedAt: "2027-05-04T12:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("asset API client", () => {
  it("uploads images using PR #2 multipart fields and manifest order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ assets: [assetSummary] }),
      { headers: { "Content-Type": "application/json" }, status: 201 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "rihanna-met-gala.jpg", {
      type: "image/jpeg",
    });

    const assets = await uploadPhotoAssets([{
      clientAssetId: "f167c99c-9ad0-4f3d-aad4-bf19cbe15a90",
      file,
    }]);

    expect(assets).toHaveLength(1);
    expect(assets[0]?.assetId).toBe(assetSummary.assetId);
    const request = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request[0]).toBe("/api/assets");
    expect(request[1].method).toBe("POST");
    expect(request[1].headers).toBeUndefined();
    const formData = request[1].body as FormData;
    expect(formData.getAll("images")).toHaveLength(1);
    expect(JSON.parse(String(formData.get("manifest")))).toEqual([{
      clientAssetId: "f167c99c-9ad0-4f3d-aad4-bf19cbe15a90",
    }]);
  });

  it("surfaces the message from the standard API error envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        error: {
          code: "ASSET_NOT_FOUND",
          message: "The asset was not found.",
        },
      }),
      { headers: { "Content-Type": "application/json" }, status: 404 },
    )));

    await expect(getPhotoAsset("64b000000000000000000001"))
      .rejects.toThrow("The asset was not found.");
  });
});

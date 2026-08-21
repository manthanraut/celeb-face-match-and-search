import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addPhotoToContent,
  getPhotoAsset,
  getPhotoEventMetadata,
  savePhotoChanges,
  updatePhotoMetadata,
  uploadPhotoAssets,
} from "./api";
import { assetDetailSchema } from "./contracts";

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
  sizeBytes: 4,
  sourceText: {
    altText: null,
    backstory: null,
    caption: null,
    revision: 1,
    title: "rihanna met gala",
  },
  updatedAt: "2027-05-04T12:00:00.000Z",
};

const assetDetail = assetDetailSchema.parse({
  ...assetSummary,
  enrichment: {
    associations: [],
    decisionEngineVersion: null,
    evaluatedAt: null,
    hideFromSearch: true,
    recognitionRevision: null,
    sourceTextRevision: null,
  },
  recognition: {
    attemptNumber: 0,
    completedAt: null,
    lastError: null,
    provider: "aws-rekognition",
    result: null,
    revision: 1,
    status: "QUEUED",
  },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("asset API client", () => {
  it("loads and updates persisted event metadata through gallery usage APIs", async () => {
    const event = { id: "met-gala", name: "Met Gala", year: 2026 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ event }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          assetCount: 1,
          event,
          galleryId: `copilot-photo-${assetSummary.assetId}`,
          published: true,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPhotoEventMetadata(assetSummary.assetId)).resolves.toEqual({ event });
    await expect(addPhotoToContent(assetSummary.assetId, "Met Gala", 2026))
      .resolves.toEqual({ event });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/galleries/assets/${assetSummary.assetId}/event-metadata`,
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/galleries/copilot-photo-${assetSummary.assetId}/context`,
      expect.objectContaining({
        body: JSON.stringify({
          assetIds: [assetSummary.assetId],
          published: true,
          tags: ["Met Gala 2026"],
        }),
        method: "PUT",
      }),
    );
  });

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
      recognitionRequested: false,
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
      recognitionRequested: false,
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

  it("saves the search visibility override with photo metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify(assetDetail),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updatePhotoMetadata(assetSummary.assetId, { hideFromSearch: true }))
      .resolves.toMatchObject({ enrichment: { hideFromSearch: true } });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/assets/${assetSummary.assetId}/metadata`,
      expect.objectContaining({
        body: JSON.stringify({ hideFromSearch: true }),
        method: "PATCH",
      }),
    );
  });

  it("saves photo and Event Metadata in one API request", async () => {
    const event = { id: "met-gala", name: "Met Gala", year: 2026 } as const;
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        asset: assetDetail,
        eventMetadata: { event },
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(savePhotoChanges(
      assetSummary.assetId,
      { title: "Updated title" },
      event,
    )).resolves.toEqual({
      asset: assetDetail,
      eventMetadata: { event },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/assets/${assetSummary.assetId}/editorial`,
      expect.objectContaining({
        body: JSON.stringify({
          eventMetadata: event,
          metadata: { title: "Updated title" },
        }),
        method: "PATCH",
      }),
    );
  });
});

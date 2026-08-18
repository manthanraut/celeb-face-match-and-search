import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import type { Asset, AssetDetail, AssetUploadResult } from "../../shared/assets.js";
import { MAX_ASSET_UPLOAD_FILE_SIZE_BYTES } from "../../shared/assets.js";
import { createApp } from "../../server/app.js";
import { ApiError } from "../../server/middleware/error-handler.js";
import type { AssetRouteService } from "../../server/routes/assets.js";
import { startTestHttpServer } from "../helpers/http-server.js";

const ASSET_ID = "64b000000000000000000001";
const CLIENT_ASSET_ID = "f167c99c-9ad0-4f3d-aad4-bf19cbe15a90";
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    assetId: ASSET_ID,
    originalFilename: "001-rihanna-at-the-met-gala.png",
    mimeType: "image/png",
    sizeBytes: PNG_BYTES.length,
    sourceText: {
      altText: null,
      caption: null,
      revision: 1,
      title: "rihanna at the met gala",
    },
    recognitionStatus: "QUEUED",
    searchReady: false,
    createdAt: "2027-05-04T12:00:00.000Z",
    updatedAt: "2027-05-04T12:00:00.000Z",
    links: {
      admin: `/admin/photos/${ASSET_ID}`,
      image: `/api/assets/${ASSET_ID}/image`,
      self: `/api/assets/${ASSET_ID}`,
    },
    ...overrides,
  };
}

function createAssetDetail(overrides: Partial<AssetDetail> = {}): AssetDetail {
  return {
    ...createAsset(overrides),
    recognition: {
      attemptNumber: 0,
      completedAt: null,
      lastError: null,
      provider: "aws-rekognition",
      result: null,
      revision: 1,
      status: "QUEUED",
    },
    ...overrides,
  };
}

function createAssetService(overrides: Partial<AssetRouteService> = {}): AssetRouteService {
  const asset = createAsset();

  return {
    getById: vi.fn(async () => createAssetDetail()),
    ingest: vi.fn(async () => ({
      assets: [{ ...asset, created: true }],
      createdAny: true,
    })),
    list: vi.fn(async () => ({ assets: [asset], nextCursor: null })),
    openImage: vi.fn(async () => ({
      etag: `"${"a".repeat(64)}"`,
      mimeType: asset.mimeType,
      sizeBytes: PNG_BYTES.length,
      stream: Readable.from(PNG_BYTES),
    })),
    retryRecognition: vi.fn(async () => ({
      assetId: ASSET_ID,
      recognitionStatus: "QUEUED" as const,
    })),
    ...overrides,
  };
}

async function startAssetApi(assetService: AssetRouteService) {
  return startTestHttpServer(
    createApp({
      assetService,
      checkDatabaseReadiness: () => Promise.resolve(),
      recognitionProvider: "aws-rekognition",
    }),
  );
}

describe("asset API", () => {
  it("parses single and multi-image uploads in manifest order", async () => {
    const firstAsset = createAsset();
    const secondAsset = createAsset({
      assetId: "64b000000000000000000002",
      originalFilename: "zendaya.jpg",
    });
    const uploadedAssets: AssetUploadResult[] = [
      { ...firstAsset, created: true },
      { ...secondAsset, created: true },
    ];
    const assetService = createAssetService({
      ingest: vi.fn(async () => ({ assets: uploadedAssets, createdAny: true })),
    });
    const testServer = await startAssetApi(assetService);
    const secondClientAssetId = "16dc75d4-0167-45dc-b533-14e43f1a5767";
    const form = new FormData();
    form.append("images", new Blob([PNG_BYTES]), "001-rihanna-at-the-met-gala.png");
    form.append("images", new Blob([Buffer.from([0xff, 0xd8, 0xff])]), "zendaya.jpg");
    form.append(
      "manifest",
      JSON.stringify([
        { clientAssetId: CLIENT_ASSET_ID },
        { clientAssetId: secondClientAssetId },
      ]),
    );

    try {
      const response = await fetch(`${testServer.baseUrl}/api/assets`, {
        body: form,
        method: "POST",
      });

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({ assets: uploadedAssets });
      expect(assetService.ingest).toHaveBeenCalledWith([
        {
          buffer: PNG_BYTES,
          clientAssetId: CLIENT_ASSET_ID,
          originalFilename: "001-rihanna-at-the-met-gala.png",
        },
        {
          buffer: Buffer.from([0xff, 0xd8, 0xff]),
          clientAssetId: secondClientAssetId,
          originalFilename: "zendaya.jpg",
        },
      ]);
    } finally {
      await testServer.close();
    }
  });

  it("accepts the maximum 10 images plus the manifest field", async () => {
    const ingest = vi.fn(async (_uploads: Parameters<AssetRouteService["ingest"]>[0]) => ({
      assets: [{ ...createAsset(), created: true }],
      createdAny: true,
    }));
    const assetService = createAssetService({ ingest });
    const testServer = await startAssetApi(assetService);
    const form = new FormData();
    const manifest = Array.from({ length: 10 }, (_, index) => ({
      clientAssetId: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    }));

    for (let index = 0; index < 10; index += 1) {
      form.append("images", new Blob([PNG_BYTES]), `arrival-${index + 1}.png`);
    }
    form.append("manifest", JSON.stringify(manifest));

    try {
      const response = await fetch(`${testServer.baseUrl}/api/assets`, {
        body: form,
        method: "POST",
      });

      expect(response.status).toBe(201);
      expect(ingest).toHaveBeenCalledTimes(1);
      expect(ingest.mock.calls[0][0]).toHaveLength(10);
    } finally {
      await testServer.close();
    }
  });

  it.each([
    {
      body: Buffer.from("not-a-multipart-body"),
      contentType: "multipart/form-data",
      scenario: "a missing boundary",
    },
    {
      body: Buffer.concat([
        Buffer.from(
          "--incomplete\r\nContent-Disposition: form-data; name=\"images\"; filename=\"arrival.png\"\r\nContent-Type: image/png\r\n\r\n",
        ),
        PNG_BYTES,
      ]),
      contentType: "multipart/form-data; boundary=incomplete",
      scenario: "a truncated form",
    },
  ])("returns a stable multipart error for $scenario", async ({ body, contentType }) => {
    const assetService = createAssetService();
    const testServer = await startAssetApi(assetService);

    try {
      const response = await fetch(`${testServer.baseUrl}/api/assets`, {
        body,
        headers: { "Content-Type": contentType },
        method: "POST",
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "INVALID_MULTIPART_REQUEST",
          message: "The multipart upload request is invalid.",
        },
      });
      expect(assetService.ingest).not.toHaveBeenCalled();
    } finally {
      await testServer.close();
    }
  });

  it("limits in-memory parsing to two concurrent upload requests", async () => {
    const ingestResult = {
      assets: [{ ...createAsset(), created: true }],
      createdAny: true,
    };
    let resolveIngest!: (value: typeof ingestResult) => void;
    const pendingIngest = new Promise<typeof ingestResult>((resolve) => {
      resolveIngest = resolve;
    });
    const ingest = vi.fn(() => pendingIngest);
    const assetService = createAssetService({ ingest });
    const testServer = await startAssetApi(assetService);
    const requests: Promise<Response>[] = [];

    const createForm = () => {
      const form = new FormData();
      form.append("images", new Blob([PNG_BYTES]), "arrival.png");
      form.append("manifest", JSON.stringify([{ clientAssetId: CLIENT_ASSET_ID }]));
      return form;
    };

    try {
      requests.push(
        fetch(`${testServer.baseUrl}/api/assets`, { body: createForm(), method: "POST" }),
        fetch(`${testServer.baseUrl}/api/assets`, { body: createForm(), method: "POST" }),
      );
      await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(2));

      const rejectedResponse = await fetch(`${testServer.baseUrl}/api/assets`, {
        body: createForm(),
        method: "POST",
      });

      expect(rejectedResponse.status).toBe(429);
      await expect(rejectedResponse.json()).resolves.toEqual({
        error: {
          code: "UPLOAD_CONCURRENCY_LIMIT_EXCEEDED",
          message: "Too many image uploads are in progress. Try again shortly.",
        },
      });
      expect(ingest).toHaveBeenCalledTimes(2);

      resolveIngest(ingestResult);
      const completedResponses = await Promise.all(requests);
      expect(completedResponses.map(({ status }) => status)).toEqual([201, 201]);

      const nextResponse = await fetch(`${testServer.baseUrl}/api/assets`, {
        body: createForm(),
        method: "POST",
      });
      expect(nextResponse.status).toBe(201);
      expect(ingest).toHaveBeenCalledTimes(3);
    } finally {
      resolveIngest(ingestResult);
      await Promise.allSettled(requests);
      await testServer.close();
    }
  });

  it("retains an upload slot after disconnect until pending ingestion settles", async () => {
    const ingestResult = {
      assets: [{ ...createAsset(), created: true }],
      createdAny: true,
    };
    let resolveDisconnectedIngest!: (value: typeof ingestResult) => void;
    let resolveHeldIngest!: (value: typeof ingestResult) => void;
    const disconnectedIngest = new Promise<typeof ingestResult>((resolve) => {
      resolveDisconnectedIngest = resolve;
    });
    const heldIngest = new Promise<typeof ingestResult>((resolve) => {
      resolveHeldIngest = resolve;
    });
    const ingest = vi
      .fn<AssetRouteService["ingest"]>()
      .mockImplementationOnce(() => disconnectedIngest)
      .mockImplementationOnce(() => heldIngest)
      .mockResolvedValue(ingestResult);
    const assetService = createAssetService({ ingest });
    const testServer = await startAssetApi(assetService);
    const abortController = new AbortController();

    const createForm = () => {
      const form = new FormData();
      form.append("images", new Blob([PNG_BYTES]), "arrival.png");
      form.append("manifest", JSON.stringify([{ clientAssetId: CLIENT_ASSET_ID }]));
      return form;
    };

    const disconnectedRequest = fetch(`${testServer.baseUrl}/api/assets`, {
      body: createForm(),
      method: "POST",
      signal: abortController.signal,
    });
    let heldRequest: Promise<Response> | undefined;

    try {
      await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(1));

      heldRequest = fetch(`${testServer.baseUrl}/api/assets`, {
        body: createForm(),
        method: "POST",
      });
      await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(2));

      abortController.abort();
      await expect(disconnectedRequest).rejects.toMatchObject({ name: "AbortError" });
      // Let the server observe the closed socket before probing the limiter.
      await new Promise((resolve) => setTimeout(resolve, 25));

      const rejectedWhileIngesting = await fetch(`${testServer.baseUrl}/api/assets`, {
        body: createForm(),
        method: "POST",
      });
      expect(rejectedWhileIngesting.status).toBe(429);
      expect(ingest).toHaveBeenCalledTimes(2);

      resolveDisconnectedIngest(ingestResult);
      await disconnectedIngest;
      await new Promise((resolve) => setImmediate(resolve));

      const acceptedAfterIngest = await fetch(`${testServer.baseUrl}/api/assets`, {
        body: createForm(),
        method: "POST",
      });
      expect(acceptedAfterIngest.status).toBe(201);
      expect(ingest).toHaveBeenCalledTimes(3);

      resolveHeldIngest(ingestResult);
      expect((await heldRequest).status).toBe(201);
    } finally {
      abortController.abort();
      resolveDisconnectedIngest(ingestResult);
      resolveHeldIngest(ingestResult);
      await Promise.allSettled([disconnectedRequest, heldRequest]);
      await testServer.close();
    }
  });

  it("returns 200 when an upload is a complete idempotent replay", async () => {
    const asset = createAsset();
    const assetService = createAssetService({
      ingest: vi.fn(async () => ({
        assets: [{ ...asset, created: false }],
        createdAny: false,
      })),
    });
    const testServer = await startAssetApi(assetService);
    const form = new FormData();
    form.append("images", new Blob([PNG_BYTES]), asset.originalFilename);
    form.append("manifest", JSON.stringify([{ clientAssetId: CLIENT_ASSET_ID }]));

    try {
      const response = await fetch(`${testServer.baseUrl}/api/assets`, {
        body: form,
        method: "POST",
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        assets: [{ ...asset, created: false }],
      });
    } finally {
      await testServer.close();
    }
  });

  it("validates that every image has a manifest entry", async () => {
    const assetService = createAssetService();
    const testServer = await startAssetApi(assetService);
    const form = new FormData();
    form.append("images", new Blob([PNG_BYTES]), "arrival.png");
    form.append("manifest", "[]");

    try {
      const response = await fetch(`${testServer.baseUrl}/api/assets`, {
        body: form,
        method: "POST",
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
      expect(assetService.ingest).not.toHaveBeenCalled();
    } finally {
      await testServer.close();
    }
  });

  it("rejects an image larger than the configured limit before ingestion", async () => {
    const assetService = createAssetService();
    const testServer = await startAssetApi(assetService);
    const form = new FormData();
    form.append(
      "images",
      new Blob([new Uint8Array(MAX_ASSET_UPLOAD_FILE_SIZE_BYTES + 1)]),
      "oversized.jpg",
    );
    form.append("manifest", JSON.stringify([{ clientAssetId: CLIENT_ASSET_ID }]));

    try {
      const response = await fetch(`${testServer.baseUrl}/api/assets`, {
        body: form,
        method: "POST",
      });

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "UPLOAD_FILE_TOO_LARGE",
          message: "Each image must be 5 MiB or smaller.",
        },
      });
      expect(assetService.ingest).not.toHaveBeenCalled();
    } finally {
      await testServer.close();
    }
  });

  it("lists, retrieves, and serves an asset image with safe headers", async () => {
    const asset = createAsset();
    const assetDetail = createAssetDetail();
    const assetService = createAssetService();
    const testServer = await startAssetApi(assetService);

    try {
      const listResponse = await fetch(`${testServer.baseUrl}/api/assets?limit=10`);
      expect(listResponse.status).toBe(200);
      await expect(listResponse.json()).resolves.toEqual({ assets: [asset], nextCursor: null });
      expect(assetService.list).toHaveBeenCalledWith({ limit: 10 });

      const detailResponse = await fetch(`${testServer.baseUrl}/api/assets/${ASSET_ID}`);
      expect(detailResponse.status).toBe(200);
      await expect(detailResponse.json()).resolves.toEqual(assetDetail);

      const imageResponse = await fetch(`${testServer.baseUrl}/api/assets/${ASSET_ID}/image`);
      expect(imageResponse.status).toBe(200);
      expect(imageResponse.headers.get("content-type")).toBe("image/png");
      expect(imageResponse.headers.get("content-length")).toBe(PNG_BYTES.length.toString());
      expect(imageResponse.headers.get("x-content-type-options")).toBe("nosniff");
      expect(Buffer.from(await imageResponse.arrayBuffer())).toEqual(PNG_BYTES);

      const cachedImageResponse = await fetch(`${testServer.baseUrl}/api/assets/${ASSET_ID}/image`, {
        headers: { "If-None-Match": `"${"a".repeat(64)}"` },
      });
      expect(cachedImageResponse.status).toBe(304);
      expect(cachedImageResponse.headers.get("content-length")).toBeNull();
    } finally {
      await testServer.close();
    }
  });

  it("returns the stable missing-asset error", async () => {
    const assetService = createAssetService({
      getById: vi.fn(async () => {
        throw new ApiError(404, "ASSET_NOT_FOUND", "The asset was not found.");
      }),
    });
    const testServer = await startAssetApi(assetService);

    try {
      const response = await fetch(`${testServer.baseUrl}/api/assets/${ASSET_ID}`);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "ASSET_NOT_FOUND",
          message: "The asset was not found.",
        },
      });
    } finally {
      await testServer.close();
    }
  });

  it("accepts an explicit recognition retry", async () => {
    const assetService = createAssetService();
    const testServer = await startAssetApi(assetService);

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/assets/${ASSET_ID}/recognition/retry`,
        { method: "POST" },
      );

      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toEqual({
        assetId: ASSET_ID,
        recognitionStatus: "QUEUED",
      });
      expect(assetService.retryRecognition).toHaveBeenCalledWith(ASSET_ID);
    } finally {
      await testServer.close();
    }
  });

  it("returns a stable conflict when recognition is not retryable", async () => {
    const assetService = createAssetService({
      retryRecognition: vi.fn(async () => {
        throw new ApiError(
          409,
          "RECOGNITION_RETRY_NOT_ALLOWED",
          "Recognition can be retried only after a failed or indeterminate attempt.",
        );
      }),
    });
    const testServer = await startAssetApi(assetService);

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/assets/${ASSET_ID}/recognition/retry`,
        { method: "POST" },
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "RECOGNITION_RETRY_NOT_ALLOWED",
          message: "Recognition can be retried only after a failed or indeterminate attempt.",
        },
      });
    } finally {
      await testServer.close();
    }
  });
});

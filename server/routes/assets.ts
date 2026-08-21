import { pipeline } from "node:stream/promises";

import { Router } from "express";

import {
  assetIdSchema,
  assetListQuerySchema,
  assetMetadataUpdateSchema,
  assetUploadManifestSchema,
} from "../../shared/assets.js";
import { photoSaveRequestSchema } from "../../shared/photoSave.js";
import { ApiError } from "../middleware/error-handler.js";
import { createImageUploadHandlers } from "../middleware/image-upload.js";
import type { AssetService, PreparedAssetUpload } from "../services/AssetService.js";
import type { PhotoSaveService } from "../services/PhotoSaveService.js";

export type AssetRouteService = Pick<
  AssetService,
  "getById" | "ingest" | "list" | "openImage" | "retryRecognition" | "updateMetadata"
>;
export type PhotoSaveRouteService = Pick<PhotoSaveService, "save">;

export function createAssetRouter(
  assetService: AssetRouteService,
  photoSaveService: PhotoSaveRouteService,
): Router {
  const assetRouter = Router();
  const imageUploadHandlers = createImageUploadHandlers();

  assetRouter.post("/", ...imageUploadHandlers.middleware, async (request, response) => {
    try {
      const files = Array.isArray(request.files) ? request.files : [];
      if (files.length === 0) {
        throw new ApiError(
          400,
          "UPLOAD_FILES_REQUIRED",
          "Upload at least one image using the images field.",
        );
      }

      const manifest = parseUploadManifest(
        (request.body as { manifest?: unknown } | undefined)?.manifest,
      );
      if (manifest.length !== files.length) {
        throw new ApiError(
          400,
          "UPLOAD_MANIFEST_MISMATCH",
          "The upload manifest must contain one entry for each image.",
        );
      }

      const uploads: PreparedAssetUpload[] = files.map((file, index) => ({
        buffer: file.buffer,
        clientAssetId: manifest[index].clientAssetId,
        originalFilename: file.originalname,
        recognitionRequested: manifest[index].recognitionRequested,
      }));
      const result = await assetService.ingest(uploads);

      response.status(result.createdAny ? 201 : 200).json({ assets: result.assets });
    } finally {
      imageUploadHandlers.releaseAfterRoute(response);
    }
  });

  assetRouter.get("/", async (request, response) => {
    const query = assetListQuerySchema.parse(request.query);
    response.json(await assetService.list(query));
  });

  assetRouter.get("/:assetId/image", async (request, response) => {
    const assetId = assetIdSchema.parse(request.params.assetId);
    const image = await assetService.openImage(assetId);

    response.set({
      "Cache-Control": "private, max-age=3600",
      ETag: image.etag,
      "X-Content-Type-Options": "nosniff",
    });

    if (request.headers["if-none-match"] === image.etag) {
      image.stream.destroy();
      response.status(304).end();
      return;
    }

    response.set({
      "Content-Disposition": "inline",
      "Content-Length": image.sizeBytes.toString(),
      "Content-Type": image.mimeType,
    });

    await pipeline(image.stream, response);
  });

  assetRouter.post("/:assetId/recognition/retry", async (request, response) => {
    const assetId = assetIdSchema.parse(request.params.assetId);
    response.status(202).json(await assetService.retryRecognition(assetId));
  });

  assetRouter.patch("/:assetId/metadata", async (request, response) => {
    const assetId = assetIdSchema.parse(request.params.assetId);
    const metadata = assetMetadataUpdateSchema.parse(request.body);
    response.json(await assetService.updateMetadata(assetId, metadata));
  });

  assetRouter.patch("/:assetId/editorial", async (request, response) => {
    const assetId = assetIdSchema.parse(request.params.assetId);
    const update = photoSaveRequestSchema.parse(request.body);
    response.json(await photoSaveService.save(assetId, update));
  });

  assetRouter.get("/:assetId", async (request, response) => {
    const assetId = assetIdSchema.parse(request.params.assetId);
    response.json(await assetService.getById(assetId));
  });

  return assetRouter;
}

function parseUploadManifest(value: unknown) {
  if (typeof value !== "string") {
    throw new ApiError(
      400,
      "UPLOAD_MANIFEST_REQUIRED",
      "Provide a JSON upload manifest containing one clientAssetId per image.",
    );
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new ApiError(400, "INVALID_UPLOAD_MANIFEST", "The upload manifest must contain valid JSON.");
  }

  return assetUploadManifestSchema.parse(parsedValue);
}

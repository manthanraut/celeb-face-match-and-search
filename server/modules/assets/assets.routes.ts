import express, { Router } from "express";
import { z } from "zod";

import { assetIdSchema } from "../../../shared/contracts/assets.js";
import type { AssetsService } from "./assets.service.js";
import type { RecognitionWorker } from "../recognition/recognition.worker.js";

const uploadHeadersSchema = z.object({
  fileName: z.string().min(1),
  height: z.coerce.number().int().positive(),
  lastModified: z.coerce.number().int().nonnegative(),
  width: z.coerce.number().int().positive(),
});

function decodeFileName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("The uploaded filename is invalid.");
  }
}

export function createAssetsRouter(
  assets: AssetsService,
  recognitionWorker: RecognitionWorker,
  maximumUploadBytes: number,
) {
  const router = Router();

  router.post(
    "/",
    express.raw({ limit: maximumUploadBytes, type: ["image/jpeg", "image/png"] }),
    async (request, response) => {
      const mimeType = request.headers["content-type"]?.split(";")[0];
      if (mimeType !== "image/jpeg" && mimeType !== "image/png") {
        response.status(415).json({ error: "Upload a JPEG or PNG image." });
        return;
      }

      if (!Buffer.isBuffer(request.body) || request.body.byteLength === 0) {
        response.status(400).json({ error: "The image body is empty." });
        return;
      }

      const headers = uploadHeadersSchema.parse({
        fileName: request.headers["x-file-name"],
        height: request.headers["x-image-height"],
        lastModified: request.headers["x-file-last-modified"],
        width: request.headers["x-image-width"],
      });
      const asset = await assets.create({
        contents: request.body,
        fileName: decodeFileName(headers.fileName),
        height: headers.height,
        lastModified: headers.lastModified,
        mimeType,
        width: headers.width,
      });

      recognitionWorker.enqueue(asset.id);
      response.location(`/api/assets/${asset.id}`).status(202).json({ asset });
    },
  );

  router.get("/:assetId", async (request, response) => {
    const assetId = assetIdSchema.parse(request.params.assetId);
    response.json(await assets.get(assetId));
  });

  router.get("/:assetId/image", async (request, response) => {
    const assetId = assetIdSchema.parse(request.params.assetId);
    const image = await assets.getImage(assetId);
    response.setHeader("Content-Type", image.asset.image.mimeType);
    response.setHeader("Content-Length", image.contents.byteLength);
    response.setHeader("Cache-Control", "private, max-age=3600");
    response.send(image.contents);
  });

  router.patch("/:assetId/metadata", async (request, response) => {
    const assetId = assetIdSchema.parse(request.params.assetId);
    const asset = await assets.updateSourceText(assetId, request.body);
    response.json({ asset, rawRecognitionResponse: await assets.get(assetId).then((result) => result.rawRecognitionResponse) });
  });

  router.post("/:assetId/recognition", async (request, response) => {
    const assetId = assetIdSchema.parse(request.params.assetId);
    const asset = await assets.queueRecognition(assetId);
    recognitionWorker.enqueue(assetId);
    response.status(202).json({ asset });
  });

  return router;
}

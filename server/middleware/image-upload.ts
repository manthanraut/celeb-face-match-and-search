import type { RequestHandler, Response } from "express";
import multer from "multer";

import {
  MAX_ASSET_UPLOAD_FILES,
  MAX_ASSET_UPLOAD_FILE_SIZE_BYTES,
} from "../../shared/assets.js";
import { ApiError } from "./error-handler.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldNameSize: 100,
    fieldSize: 16 * 1024,
    fields: 1,
    fileSize: MAX_ASSET_UPLOAD_FILE_SIZE_BYTES,
    files: MAX_ASSET_UPLOAD_FILES,
    headerPairs: 100,
    // Busboy emits its limit event when the configured number is reached, so
    // leave one additional slot for the 10 images plus their manifest field.
    parts: MAX_ASSET_UPLOAD_FILES + 2,
  },
  preservePath: false,
});

const MAX_CONCURRENT_IMAGE_UPLOADS = 2;
const parseMultipartImages = upload.array("images", MAX_ASSET_UPLOAD_FILES);

interface UploadLease {
  handOffToRoute: () => boolean;
  release: () => void;
}

export interface ImageUploadHandlers {
  middleware: RequestHandler[];
  releaseAfterRoute: (response: Response) => void;
}

export function createImageUploadHandlers(): ImageUploadHandlers {
  let activeUploads = 0;
  const leases = new WeakMap<Response, UploadLease>();

  const limitConcurrentUploads: RequestHandler = (request, response, next) => {
    if (activeUploads >= MAX_CONCURRENT_IMAGE_UPLOADS) {
      request.resume();
      response.status(429).json({
        error: {
          code: "UPLOAD_CONCURRENCY_LIMIT_EXCEEDED",
          message: "Too many image uploads are in progress. Try again shortly.",
        },
      });
      return;
    }

    activeUploads += 1;
    let released = false;

    const removeEarlyReleaseListeners = () => {
      response.off("finish", release);
      response.off("close", release);
      response.off("error", release);
      request.off("error", release);
      request.off("aborted", release);
    };

    const release = () => {
      if (released) {
        return;
      }

      released = true;
      activeUploads -= 1;
      removeEarlyReleaseListeners();
      leases.delete(response);
    };

    const lease: UploadLease = {
      handOffToRoute: () => {
        if (released) {
          return false;
        }

        removeEarlyReleaseListeners();
        return true;
      },
      release,
    };

    leases.set(response, lease);

    response.once("finish", release);
    response.once("close", release);
    response.once("error", release);
    request.once("error", release);
    request.once("aborted", release);

    next();
  };

  const parseImageUpload: RequestHandler = (request, response, next) => {
    parseMultipartImages(request, response, (error: unknown) => {
      if (error === undefined) {
        // Once Multer has populated the in-memory buffers, the route owns the
        // lease. A disconnected client must not free capacity while ingestion
        // is still using those buffers or writing the asset.
        if (!leases.get(response)?.handOffToRoute()) {
          return;
        }

        next();
        return;
      }

      leases.get(response)?.release();

      if (error instanceof multer.MulterError) {
        next(error);
        return;
      }

      next(
        new ApiError(
          400,
          "INVALID_MULTIPART_REQUEST",
          "The multipart upload request is invalid.",
        ),
      );
    });
  };

  return {
    middleware: [limitConcurrentUploads, parseImageUpload],
    releaseAfterRoute: (response) => {
      leases.get(response)?.release();
    },
  };
}

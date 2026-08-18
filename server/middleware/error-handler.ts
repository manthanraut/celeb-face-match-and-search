import type { ErrorRequestHandler } from "express";
import { z } from "zod";

import { AssetNotFoundError } from "../modules/assets/assets.repository.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof AssetNotFoundError) {
    response.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof z.ZodError) {
    response.status(400).json({ error: "The request is invalid.", details: z.prettifyError(error) });
    return;
  }

  if ((error as { type?: string }).type === "entity.too.large") {
    response.status(413).json({ error: "The image is larger than the configured upload limit." });
    return;
  }

  console.error("Unhandled API error.", error);
  response.status(500).json({ error: "The request could not be completed." });
};

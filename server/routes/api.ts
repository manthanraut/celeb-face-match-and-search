import { Router } from "express";

import { environment } from "../config/env.js";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    recognitionProvider: environment.RECOGNITION_PROVIDER,
  });
});

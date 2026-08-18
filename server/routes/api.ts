import { Router } from "express";

import { environment } from "../config/env.js";
import { AssetsRepository } from "../modules/assets/assets.repository.js";
import { createAssetsRouter } from "../modules/assets/assets.routes.js";
import { AssetsService } from "../modules/assets/assets.service.js";
import { AwsRekognitionProvider } from "../modules/recognition/AwsRekognitionProvider.js";
import { RecognitionRepository } from "../modules/recognition/recognition.repository.js";
import { RecognitionWorker } from "../modules/recognition/recognition.worker.js";
import { LocalFileStorage } from "../storage/LocalFileStorage.js";

export const apiRouter = Router();
const storage = new LocalFileStorage(environment.LOCAL_DATA_DIRECTORY);
const assetsRepository = new AssetsRepository(storage);
const recognitionRepository = new RecognitionRepository(storage);
const assetsService = new AssetsService(
  assetsRepository,
  recognitionRepository,
  storage,
  environment.RECOGNITION_AUTO_APPROVE_THRESHOLD,
);
const recognitionProvider = new AwsRekognitionProvider(environment.AWS_REGION);
const recognitionWorker = new RecognitionWorker(
  assetsRepository,
  recognitionRepository,
  storage,
  recognitionProvider,
  environment.RECOGNITION_AUTO_APPROVE_THRESHOLD,
);

apiRouter.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    recognitionProvider: environment.RECOGNITION_PROVIDER,
  });
});

apiRouter.use(
  "/assets",
  createAssetsRouter(assetsService, recognitionWorker, environment.MAX_UPLOAD_BYTES),
);

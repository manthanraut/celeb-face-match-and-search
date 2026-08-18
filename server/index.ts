import path from "node:path";

import { createApp } from "./app.js";
import { environment } from "./config/env.js";
import { MongoDatabase } from "./database/MongoDatabase.js";
import { ensureDatabaseIndexes } from "./database/indexes.js";
import { configureFrontend } from "./frontend.js";
import { closeServer, listen, startServer } from "./lifecycle.js";
import { EnrichmentService } from "./modules/enrichment/EnrichmentService.js";
import { createRecognitionProvider } from "./modules/recognition/createRecognitionProvider.js";
import { RecognitionWorker } from "./modules/recognition/RecognitionWorker.js";
import { MongoAssetRepository } from "./repositories/MongoAssetRepository.js";
import { MongoCelebrityRepository } from "./repositories/MongoCelebrityRepository.js";
import { MongoGalleryUsageRepository } from "./repositories/MongoGalleryUsageRepository.js";
import { AssetService } from "./services/AssetService.js";
import { GalleryService } from "./services/GalleryService.js";
import { LocalImageStorage } from "./storage/LocalImageStorage.js";

const projectRoot = process.cwd();

async function main(): Promise<void> {
  const database = new MongoDatabase({
    databaseName: environment.MONGODB_DATABASE,
    uri: environment.MONGODB_URI,
  });
  const imageStorage = new LocalImageStorage(path.resolve(projectRoot, environment.UPLOAD_DIR));
  await imageStorage.initialize();
  const recognitionProvider = createRecognitionProvider(
    environment.RECOGNITION_PROVIDER,
    environment.AWS_REGION,
  );

  let recognitionWorker!: RecognitionWorker;
  let runningServer;
  try {
    runningServer = await startServer({
      closeServer,
      configureFrontend: (app) => configureFrontend(app, projectRoot, environment.NODE_ENV),
      createApplication: () => {
        const assetRepository = new MongoAssetRepository(database.db);
        const enrichmentService = new EnrichmentService({
          approvalThreshold: environment.RECOGNITION_APPROVAL_THRESHOLD,
          assetRepository,
          celebrityRepository: new MongoCelebrityRepository(database.db),
          enrichmentRepository: assetRepository,
        });
        recognitionWorker = new RecognitionWorker({
          enrichmentService,
          provider: recognitionProvider,
          repository: assetRepository,
          storage: imageStorage,
        });
        const assetService = new AssetService({
          enrichmentService,
          recognitionProviderName: recognitionProvider.name,
          repository: assetRepository,
          storage: imageStorage,
        });
        const galleryService = new GalleryService({
          assetRepository,
          usageRepository: new MongoGalleryUsageRepository(database.db),
        });

        return createApp({
          assetService,
          checkDatabaseReadiness: () => database.ping(),
          galleryService,
          recognitionProvider: recognitionProvider.name,
        });
      },
      database,
      ensureDatabaseIndexes,
      listen: (app) => listen(app, environment.PORT),
    });
  } catch (error) {
    recognitionProvider.close?.();
    throw error;
  }

  recognitionWorker.start();

  console.log(`Application available at http://localhost:${environment.PORT}`);

  let shutdownPromise: Promise<void> | null = null;
  const shutdown = () => {
    shutdownPromise ??= shutdownApplication(recognitionWorker, runningServer);
    return shutdownPromise;
  };
  const handleSignal = (signal: NodeJS.Signals) => {
    console.log(`Received ${signal}; shutting down.`);
    void shutdown().catch(() => {
      console.error("Unable to shut down cleanly.");
      process.exitCode = 1;
    });
  };

  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));
}

async function shutdownApplication(
  recognitionWorker: RecognitionWorker,
  runningServer: { shutdown(): Promise<void> },
): Promise<void> {
  let workerError: unknown;
  try {
    await recognitionWorker.stop();
  } catch (error) {
    workerError = error;
  }

  await runningServer.shutdown();
  if (workerError) {
    throw workerError;
  }
}

main().catch(() => {
  console.error("Unable to start the application.");
  process.exitCode = 1;
});

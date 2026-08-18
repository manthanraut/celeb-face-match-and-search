import path from "node:path";

import { createApp } from "./app.js";
import { environment } from "./config/env.js";
import { MongoDatabase } from "./database/MongoDatabase.js";
import { ensureDatabaseIndexes } from "./database/indexes.js";
import { configureFrontend } from "./frontend.js";
import { closeServer, listen, startServer } from "./lifecycle.js";

const projectRoot = process.cwd();

async function main(): Promise<void> {
  const database = new MongoDatabase({
    databaseName: environment.MONGODB_DATABASE,
    uri: environment.MONGODB_URI,
  });
  const runningServer = await startServer({
    closeServer,
    configureFrontend: (app) => configureFrontend(app, projectRoot, environment.NODE_ENV),
    createApplication: () =>
      createApp({
        checkDatabaseReadiness: () => database.ping(),
        recognitionProvider: environment.RECOGNITION_PROVIDER,
      }),
    database,
    ensureDatabaseIndexes,
    listen: (app) => listen(app, environment.PORT),
  });

  console.log(`Application available at http://localhost:${environment.PORT}`);

  const handleSignal = (signal: NodeJS.Signals) => {
    console.log(`Received ${signal}; shutting down.`);
    void runningServer.shutdown().catch(() => {
      console.error("Unable to shut down cleanly.");
      process.exitCode = 1;
    });
  };

  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));
}

main().catch(() => {
  console.error("Unable to start the application.");
  process.exitCode = 1;
});

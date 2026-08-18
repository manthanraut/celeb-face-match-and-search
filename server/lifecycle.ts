import type { Server } from "node:http";

import type { Express } from "express";

import type { FrontendCleanup } from "./frontend.js";

interface LifecycleDatabase<TConnectedDatabase> {
  close(): Promise<void>;
  connect(): Promise<TConnectedDatabase>;
}

export interface ServerLifecycleDependencies<TConnectedDatabase, TApplication, TServer> {
  closeServer(server: TServer): Promise<void>;
  configureFrontend(application: TApplication): Promise<FrontendCleanup>;
  createApplication(): TApplication;
  database: LifecycleDatabase<TConnectedDatabase>;
  ensureDatabaseIndexes(database: TConnectedDatabase): Promise<void>;
  listen(application: TApplication): Promise<TServer>;
}

export interface RunningServer {
  shutdown(): Promise<void>;
}

export async function startServer<TConnectedDatabase, TApplication, TServer>({
  closeServer,
  configureFrontend,
  createApplication,
  database,
  ensureDatabaseIndexes,
  listen,
}: ServerLifecycleDependencies<TConnectedDatabase, TApplication, TServer>): Promise<RunningServer> {
  let closeFrontend: FrontendCleanup = () => Promise.resolve();

  try {
    const connectedDatabase = await database.connect();
    await ensureDatabaseIndexes(connectedDatabase);

    const application = createApplication();
    closeFrontend = await configureFrontend(application);
    const server = await listen(application);

    return {
      shutdown: createShutdown(server, closeServer, closeFrontend, database),
    };
  } catch (error) {
    await settleCleanups([closeFrontend, () => database.close()]);
    throw error;
  }
}

export function listen(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    const handleError = (error: Error) => {
      server.off("listening", handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off("error", handleError);
      resolve(server);
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
  });
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function createShutdown<TConnectedDatabase, TServer>(
  server: TServer,
  closeServer: (server: TServer) => Promise<void>,
  closeFrontend: FrontendCleanup,
  database: LifecycleDatabase<TConnectedDatabase>,
): FrontendCleanup {
  let shutdownPromise: Promise<void> | null = null;

  return () => {
    if (!shutdownPromise) {
      shutdownPromise = runCleanupsInOrder([
        () => closeServer(server),
        closeFrontend,
        () => database.close(),
      ]);
    }

    return shutdownPromise;
  };
}

async function settleCleanups(cleanups: FrontendCleanup[]): Promise<void> {
  await Promise.allSettled(cleanups.map((cleanup) => Promise.resolve().then(cleanup)));
}

async function runCleanupsInOrder(cleanups: FrontendCleanup[]): Promise<void> {
  let firstError: unknown;
  let hasError = false;

  for (const cleanup of cleanups) {
    try {
      await cleanup();
    } catch (error) {
      if (!hasError) {
        firstError = error;
        hasError = true;
      }
    }
  }

  if (hasError) {
    throw firstError;
  }
}

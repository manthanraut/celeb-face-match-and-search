import path from "node:path";

import express, { type Express } from "express";

import type { Environment } from "./config/env.js";

export type FrontendCleanup = () => Promise<void>;

export async function configureFrontend(
  app: Express,
  projectRoot: string,
  nodeEnvironment: Environment["NODE_ENV"],
): Promise<FrontendCleanup> {
  if (nodeEnvironment === "production") {
    const clientBuildPath = path.join(projectRoot, "dist");
    app.use(express.static(clientBuildPath));
    app.use((request, response, next) => {
      if (request.method !== "GET") {
        next();
        return;
      }

      response.sendFile(path.join(clientBuildPath, "index.html"));
    });

    return () => Promise.resolve();
  }

  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: projectRoot,
    appType: "spa",
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);

  return async () => {
    await vite.close();
  };
}

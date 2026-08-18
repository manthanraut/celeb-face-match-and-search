import express from "express";
import path from "node:path";
import { createServer as createViteServer } from "vite";

import { createApp } from "./app.js";
import { environment } from "./config/env.js";

const projectRoot = process.cwd();

async function startServer() {
  const app = createApp();

  if (environment.NODE_ENV === "production") {
    const clientBuildPath = path.join(projectRoot, "dist");
    app.use(express.static(clientBuildPath));
    app.use((request, response, next) => {
      if (request.method !== "GET") {
        next();
        return;
      }

      response.sendFile(path.join(clientBuildPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      root: projectRoot,
      appType: "spa",
      server: { middlewareMode: true },
    });
    app.use(vite.middlewares);
  }

  app.listen(environment.PORT);
}

startServer().catch((error: unknown) => {
  console.error("Unable to start the application.", error);
  process.exitCode = 1;
});

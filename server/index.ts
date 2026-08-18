import express from "express";
import path from "node:path";
import { createServer as createViteServer } from "vite";

import { environment } from "./config/env.js";
import { apiRouter } from "./routes/api.js";

const projectRoot = process.cwd();

async function startServer() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRouter);

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

  app.listen(environment.PORT, () => {
    console.log(`Application available at http://localhost:${environment.PORT}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Unable to start the application.", error);
  process.exitCode = 1;
});

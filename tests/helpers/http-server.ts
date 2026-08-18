import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

export interface TestHttpServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestHttpServer(app: Express): Promise<TestHttpServer> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("The test HTTP server did not bind to a TCP address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    close: () => closeServer(server),
  };
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }

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

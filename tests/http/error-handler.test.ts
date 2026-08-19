import express from "express";
import { describe, expect, it, vi } from "vitest";

import { apiErrorHandler } from "../../server/middleware/error-handler.js";
import { startTestHttpServer } from "../helpers/http-server.js";

describe("apiErrorHandler", () => {
  it("does not misclassify other bad requests as malformed JSON", async () => {
    const app = express();
    app.get("/bad-request", (_request, _response, next) => {
      next(Object.assign(new Error("private request detail"), { status: 400, type: "request.invalid" }));
    });
    app.use(apiErrorHandler);
    const testServer = await startTestHttpServer(app);

    try {
      const response = await fetch(`${testServer.baseUrl}/bad-request`);
      const responseBody = await response.text();

      expect(response.status).toBe(400);
      expect(JSON.parse(responseBody)).toEqual({
        error: {
          code: "BAD_REQUEST",
          message: "The request could not be processed.",
        },
      });
      expect(responseBody).not.toContain("private request detail");
    } finally {
      await testServer.close();
    }
  });

  it("does not expose unexpected error details", async () => {
    const app = express();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    app.get("/failure", () => {
      throw new Error("private implementation detail");
    });
    app.use(apiErrorHandler);
    const testServer = await startTestHttpServer(app);

    try {
      const response = await fetch(`${testServer.baseUrl}/failure`);
      const responseBody = await response.text();

      expect(response.status).toBe(500);
      expect(JSON.parse(responseBody)).toEqual({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "The server could not complete the request.",
        },
      });
      expect(responseBody).not.toContain("private implementation detail");
    } finally {
      await testServer.close();
      consoleError.mockRestore();
    }
  });
});

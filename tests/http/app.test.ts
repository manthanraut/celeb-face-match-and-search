import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../server/app.js";
import { startTestHttpServer } from "../helpers/http-server.js";

describe("API health", () => {
  it("returns liveness without querying MongoDB", async () => {
    const checkDatabaseReadiness = vi.fn().mockRejectedValue(new Error("database secret"));
    const testServer = await startTestHttpServer(
      createApp({ checkDatabaseReadiness, recognitionProvider: "aws-rekognition" }),
    );

    try {
      const response = await fetch(`${testServer.baseUrl}/api/health`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        recognitionProvider: "aws-rekognition",
      });
      expect(checkDatabaseReadiness).not.toHaveBeenCalled();
    } finally {
      await testServer.close();
    }
  });

  it("returns readiness when MongoDB responds", async () => {
    const checkDatabaseReadiness = vi.fn().mockResolvedValue(undefined);
    const testServer = await startTestHttpServer(
      createApp({ checkDatabaseReadiness, recognitionProvider: "aws-rekognition" }),
    );

    try {
      const response = await fetch(`${testServer.baseUrl}/api/ready`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "ready",
        checks: { database: "up" },
      });
      expect(checkDatabaseReadiness).toHaveBeenCalledTimes(1);
    } finally {
      await testServer.close();
    }
  });

  it("returns sanitized unavailability when MongoDB cannot respond", async () => {
    const checkDatabaseReadiness = vi.fn().mockRejectedValue(new Error("mongodb://user:password@host"));
    const testServer = await startTestHttpServer(
      createApp({ checkDatabaseReadiness, recognitionProvider: "aws-rekognition" }),
    );

    try {
      const response = await fetch(`${testServer.baseUrl}/api/ready`);
      const responseBody = await response.text();

      expect(response.status).toBe(503);
      expect(JSON.parse(responseBody)).toEqual({
        status: "not-ready",
        checks: { database: "down" },
      });
      expect(responseBody).not.toContain("password");
    } finally {
      await testServer.close();
    }
  });
});

describe("API errors", () => {
  it("returns JSON for unknown API routes", async () => {
    const testServer = await startTestHttpServer(
      createApp({ checkDatabaseReadiness: () => Promise.resolve(), recognitionProvider: "aws-rekognition" }),
    );

    try {
      const response = await fetch(`${testServer.baseUrl}/api/unknown`);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "API_ROUTE_NOT_FOUND",
          message: "No API route matches GET /api/unknown.",
        },
      });
    } finally {
      await testServer.close();
    }
  });

  it("returns a safe error for malformed JSON", async () => {
    const testServer = await startTestHttpServer(
      createApp({ checkDatabaseReadiness: () => Promise.resolve(), recognitionProvider: "aws-rekognition" }),
    );

    try {
      const response = await fetch(`${testServer.baseUrl}/api/health`, {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "INVALID_JSON",
          message: "The request body must contain valid JSON.",
        },
      });
    } finally {
      await testServer.close();
    }
  });

  it("rejects JSON payloads larger than one MiB", async () => {
    const testServer = await startTestHttpServer(
      createApp({ checkDatabaseReadiness: () => Promise.resolve(), recognitionProvider: "aws-rekognition" }),
    );

    try {
      const response = await fetch(`${testServer.baseUrl}/api/health`, {
        body: JSON.stringify({ value: "x".repeat(1024 * 1024) }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "The request body exceeds the allowed size.",
        },
      });
    } finally {
      await testServer.close();
    }
  });
});

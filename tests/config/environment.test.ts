import { describe, expect, it } from "vitest";

import { parseEnvironment } from "../../server/config/env.js";

describe("parseEnvironment", () => {
  it("uses safe local defaults", () => {
    const result = parseEnvironment({});

    expect(result).toMatchObject({
      MONGODB_DATABASE: "celeb_face_match",
      MONGODB_URI: "mongodb://127.0.0.1:27017",
      PORT: 3000,
      RECOGNITION_APPROVAL_THRESHOLD: 90,
      UPLOAD_DIR: "data/uploads",
    });
  });

  it("coerces a configurable recognition threshold", () => {
    expect(parseEnvironment({ RECOGNITION_APPROVAL_THRESHOLD: "92.5" }).RECOGNITION_APPROVAL_THRESHOLD).toBe(
      92.5,
    );
  });

  it("uses the default threshold when an environment value is blank", () => {
    expect(parseEnvironment({ RECOGNITION_APPROVAL_THRESHOLD: "" }).RECOGNITION_APPROVAL_THRESHOLD).toBe(90);
  });

  it.each([
    ["0", 0],
    ["100", 100],
  ])("accepts a threshold at the %s boundary", (threshold, expected) => {
    expect(parseEnvironment({ RECOGNITION_APPROVAL_THRESHOLD: threshold }).RECOGNITION_APPROVAL_THRESHOLD).toBe(
      expected,
    );
  });

  it.each(["-1", "101", "not-a-number"])("rejects an invalid threshold of %s", (threshold) => {
    expect(() => parseEnvironment({ RECOGNITION_APPROVAL_THRESHOLD: threshold })).toThrow();
  });

  it("rejects unsupported MongoDB URI schemes", () => {
    expect(() => parseEnvironment({ MONGODB_URI: "https://localhost:27017" })).toThrow();
  });

  it("rejects unsafe database names", () => {
    expect(() => parseEnvironment({ MONGODB_DATABASE: "celeb face/match" })).toThrow();
  });

  it("rejects a blank upload directory", () => {
    expect(() => parseEnvironment({ UPLOAD_DIR: "  " })).toThrow();
  });

  it("rejects ports outside the TCP range", () => {
    expect(() => parseEnvironment({ PORT: "65536" })).toThrow();
  });
});

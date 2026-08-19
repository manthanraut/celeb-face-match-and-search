import { describe, expect, it } from "vitest";

import { formatMatchConfidence } from "./AiDiscoveryMetadataSection";

describe("AI discovery metadata formatting", () => {
  it("shows unavailable confidence for a metadata-only association", () => {
    expect(formatMatchConfidence(null)).toBe("N/A");
  });

  it("formats provider confidence as a percentage", () => {
    expect(formatMatchConfidence(98.44)).toBe("98.4%");
  });
});

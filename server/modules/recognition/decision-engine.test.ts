import { describe, expect, it } from "vitest";

import type { SourceText } from "../../../shared/contracts/assets.js";
import type { RecognitionResult } from "../../../shared/contracts/recognition.js";
import { makeEnrichmentDecision } from "./decision-engine.js";

const emptySourceText: SourceText = { altText: null, caption: null, title: null };

function recognition(name: string | null, confidence: number | null): RecognitionResult {
  return {
    faces: name ? [{
      boundingBox: null,
      candidateName: name,
      confidence,
      confidenceKind: "provider-score",
      providerPersonId: "provider-id",
      recognitionStatus: "recognized",
    }] : [],
    model: "AWS RecognizeCelebrities",
    provider: "aws-rekognition",
    schemaVersion: "1.0",
    unrecognizedFaceCount: name ? 0 : 1,
    warnings: [],
  };
}

describe("recognition decision engine", () => {
  it("accepts an AI match at the automatic approval threshold", () => {
    const result = makeEnrichmentDecision(recognition("Rihanna", 99), emptySourceText, 99);

    expect(result.celebrities[0]).toMatchObject({
      canonicalName: "Rihanna",
      searchDecision: "Accepted",
      status: "Approved",
    });
  });

  it("accepts a lower-confidence AI match when editorial text confirms the name", () => {
    const result = makeEnrichmentDecision(
      recognition("A$AP Rocky", 82.4),
      { ...emptySourceText, caption: "Rihanna and A$AP Rocky arrive together." },
      99,
    );

    expect(result.celebrities[0]).toMatchObject({
      editorialTextMatch: { matched: true, source: "caption" },
      identificationSource: "AI image recognition only + Meta",
      searchDecision: "Accepted",
    });
  });

  it("routes an unconfirmed lower-confidence AI match to review", () => {
    const result = makeEnrichmentDecision(recognition("A$AP Rocky", 91.2), emptySourceText, 99);

    expect(result.celebrities[0]).toMatchObject({
      searchDecision: "Needs Review",
      status: "Needs Review",
    });
  });

  it("does not use alt text to confirm a lower-confidence celebrity match", () => {
    const result = makeEnrichmentDecision(
      recognition("Rihanna", 91.2),
      { ...emptySourceText, altText: "Rihanna arrives on the red carpet" },
      99,
    );

    expect(result.celebrities[0]).toMatchObject({
      editorialTextMatch: { matched: false, source: null },
      identificationSource: "AI image recognition only",
      searchDecision: "Needs Review",
      status: "Needs Review",
    });
  });

  it("creates metadata-only celebrity and designer associations from X in Y text", () => {
    const result = makeEnrichmentDecision(
      recognition(null, null),
      { ...emptySourceText, title: "Zendaya in Louis Vuitton." },
      99,
    );

    expect(result.celebrities[0]).toMatchObject({
      canonicalName: "Zendaya",
      identificationSource: "Meta Only",
      searchDecision: "Accepted",
    });
    expect(result.designers[0]).toMatchObject({ name: "Louis Vuitton" });
  });

  it("creates no association when neither AI nor metadata identifies a person", () => {
    const result = makeEnrichmentDecision(
      recognition(null, null),
      { ...emptySourceText, title: "A red carpet arrival" },
      99,
    );

    expect(result).toEqual({ celebrities: [], designers: [] });
  });
});

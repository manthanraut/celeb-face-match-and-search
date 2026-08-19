import { describe, expect, it } from "vitest";

import {
  CELEBRITY_DECISION_ENGINE_VERSION,
  evaluateCelebrityDecisions,
} from "../../server/modules/enrichment/decisionEngine.js";
import type { CelebrityCatalogEntry } from "../../server/repositories/CelebrityRepository.js";
import type { RecognitionResult } from "../../shared/contracts/recognition.js";

const CATALOG: CelebrityCatalogEntry[] = [
  {
    displayName: "Rihanna",
    normalizedAliases: ["robyn rihanna fenty"],
    normalizedName: "rihanna",
    providerIdentities: [
      { personId: "aws-rihanna", provider: "aws-rekognition" },
      { personId: "fake-rihanna", provider: "fake" },
    ],
    slug: "rihanna",
  },
  {
    displayName: "Doja Cat",
    normalizedAliases: [],
    normalizedName: "doja cat",
    providerIdentities: [],
    slug: "doja-cat",
  },
  {
    displayName: "Zendaya",
    normalizedAliases: ["zendaya maree stoermer coleman"],
    normalizedName: "zendaya",
    providerIdentities: [{ personId: "aws-zendaya", provider: "aws-rekognition" }],
    slug: "zendaya",
  },
];

function recognitionResult(
  faces: RecognitionResult["faces"],
  provider: RecognitionResult["provider"] = "aws-rekognition",
): RecognitionResult {
  return {
    faces,
    model: "test-model",
    provider,
    schemaVersion: "1.0",
    unrecognizedFaceCount: 0,
    warnings: [],
  };
}

function face(
  candidateName: string | null,
  confidence: number | null,
  providerPersonId: string | null = null,
): RecognitionResult["faces"][number] {
  return {
    boundingBox: null,
    candidateName,
    confidence,
    confidenceKind: "provider-score",
    providerPersonId,
    recognitionStatus: candidateName ? "recognized" : "unknown",
  };
}

function evaluate(
  result: RecognitionResult | null,
  sourceText: {
    altText?: string | null;
    backstory?: string | null;
    caption?: string | null;
    title?: string | null;
  } = {},
) {
  return evaluateCelebrityDecisions({
    approvalThreshold: 99,
    catalog: CATALOG,
    recognitionResult: result,
    sourceText: {
      altText: sourceText.altText ?? null,
      backstory: sourceText.backstory ?? null,
      caption: sourceText.caption ?? null,
      title: sourceText.title ?? null,
    },
  });
}

describe("celebrity decision engine v2", () => {
  it("approves recognition confidence at the configured threshold", () => {
    const result = evaluate(recognitionResult([face("Rihanna", 99, "aws-rihanna")]));

    expect(result).toEqual({
      associations: [
        {
          confidence: 99,
          decision: "APPROVED",
          displayName: "Rihanna",
          evidenceFields: [],
          identityKey: "rihanna",
          providerPersonId: "aws-rihanna",
          searchDecision: "APPROVED",
          source: "recognition",
        },
      ],
      decisionEngineVersion: CELEBRITY_DECISION_ENGINE_VERSION,
    });
  });

  it("approves a low-confidence candidate corroborated by title or caption", () => {
    const result = evaluate(recognitionResult([face("Rihanna", 50.4)]), {
      caption: "Rihanna arrives at the Met Gala",
      title: "Rihanna in Marc Jacobs",
    });

    expect(result.associations[0]).toMatchObject({
      confidence: 50.4,
      decision: "APPROVED",
      evidenceFields: ["title", "caption"],
      searchDecision: "APPROVED",
    });
  });

  it("keeps an uncorroborated low-confidence candidate for review and out of search", () => {
    const result = evaluate(recognitionResult([face("Rihanna", 50.4)]), {
      caption: "A guest arrives at the gala",
    });

    expect(result.associations[0]).toMatchObject({
      decision: "NEEDS_REVIEW",
      evidenceFields: [],
      searchDecision: "NEEDS_REVIEW",
    });
  });

  it("ignores alt text as identity evidence", () => {
    const result = evaluate(recognitionResult([face("Rihanna", 50.4)]), {
      altText: "Rihanna on the red carpet",
    });

    expect(result.associations[0]).toMatchObject({
      decision: "NEEDS_REVIEW",
      evidenceFields: [],
    });
  });

  it("ignores backstory as identity evidence and for metadata-only inference", () => {
    const recognitionMatch = evaluate(recognitionResult([face("Rihanna", 50.4)]), {
      backstory: "Rihanna in Marc Jacobs before the Met Gala",
    });
    const metadataOnly = evaluate(recognitionResult([]), {
      backstory: "Rihanna in Marc Jacobs before the Met Gala",
    });

    expect(recognitionMatch.associations[0]).toMatchObject({
      decision: "NEEDS_REVIEW",
      evidenceFields: [],
    });
    expect(metadataOnly.associations).toEqual([]);
  });

  it("uses canonical catalog identity and aliases for corroboration", () => {
    const result = evaluate(recognitionResult([face("R. Fenty", 40, "aws-rihanna")]), {
      title: "Robyn Rihanna Fenty at the Met Gala",
    });

    expect(result.associations[0]).toMatchObject({
      decision: "APPROVED",
      displayName: "Rihanna",
      evidenceFields: ["title"],
      identityKey: "rihanna",
    });
  });

  it("creates a metadata-only association for catalog-backed X in Y text", () => {
    const result = evaluate(recognitionResult([]), {
      caption: "Rihanna in Marc Jacobs",
    });

    expect(result.associations).toEqual([
      {
        confidence: null,
        decision: "APPROVED",
        displayName: "Rihanna",
        evidenceFields: ["caption"],
        identityKey: "rihanna",
        providerPersonId: null,
        searchDecision: "APPROVED",
        source: "metadata-inference",
      },
    ]);
  });

  it("adds a metadata-only identity when recognition returns unrelated candidates", () => {
    const result = evaluate(
      recognitionResult([
        face("Michael Rupert", 77.7, "aws-michael-rupert"),
        face("DeMarcus Ware", 81, "aws-demarcus-ware"),
      ]),
      { title: "Doja Cat in Saint Laurent" },
    );

    expect(result.associations).toEqual([
      expect.objectContaining({
        decision: "NEEDS_REVIEW",
        displayName: "Michael Rupert",
        source: "recognition",
      }),
      expect.objectContaining({
        decision: "NEEDS_REVIEW",
        displayName: "DeMarcus Ware",
        source: "recognition",
      }),
      {
        confidence: null,
        decision: "APPROVED",
        displayName: "Doja Cat",
        evidenceFields: ["title"],
        identityKey: "doja-cat",
        providerPersonId: null,
        searchDecision: "APPROVED",
        source: "metadata-inference",
      },
    ]);
  });

  it("does not infer an unknown X in Y identity or infer before recognition completes", () => {
    expect(evaluate(recognitionResult([]), { title: "Unknown Guest in Marc Jacobs" }).associations).toEqual(
      [],
    );
    expect(evaluate(null, { title: "Rihanna in Marc Jacobs" }).associations).toEqual([]);
  });

  it("handles multiple faces and deduplicates repeated celebrity matches", () => {
    const result = evaluate(
      recognitionResult([
        face("Rihanna", 85, "aws-rihanna"),
        face("Rihanna", 95, "aws-rihanna"),
        face("Zendaya", 70, "aws-zendaya"),
      ]),
    );

    expect(result.associations).toEqual([
      expect.objectContaining({
        confidence: 95,
        decision: "NEEDS_REVIEW",
        identityKey: "rihanna",
        searchDecision: "NEEDS_REVIEW",
      }),
      expect.objectContaining({
        confidence: 70,
        decision: "NEEDS_REVIEW",
        identityKey: "zendaya",
        searchDecision: "NEEDS_REVIEW",
      }),
    ]);
  });
});

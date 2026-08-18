import type {
  CelebrityAssociation,
  SourceText,
} from "../../../shared/contracts/assets.js";
import type { RecognitionResult } from "../../../shared/contracts/recognition.js";

interface EnrichmentDecision {
  celebrities: CelebrityAssociation[];
  designers: Array<{ evidence: string; name: string }>;
}

function normalized(value: string | null) {
  return value?.toLocaleLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

function findEditorialMatch(name: string, sourceText: SourceText) {
  const candidate = normalized(name);
  const inTitle = normalized(sourceText.title).includes(candidate);
  const inCaption = normalized(sourceText.caption).includes(candidate);

  return {
    matched: inTitle || inCaption,
    source: inTitle && inCaption ? "both" as const : inTitle ? "title" as const : inCaption ? "caption" as const : null,
  };
}

function parseMetadataOnlyAssociation(sourceText: SourceText) {
  for (const [source, value] of [
    ["title", sourceText.title],
    ["caption", sourceText.caption],
  ] as const) {
    const match = value?.match(/^\s*([^,;:]+?)\s+in\s+([^,;:]+?)(?:[.!?]|$)/i);

    if (match?.[1] && match[2]) {
      return {
        celebrity: match[1].trim(),
        designer: match[2].trim(),
        source,
      };
    }
  }

  return null;
}

export function makeEnrichmentDecision(
  recognition: RecognitionResult,
  sourceText: SourceText,
  autoApproveThreshold: number,
): EnrichmentDecision {
  const celebrities = recognition.faces.flatMap((face, index) => {
    if (!face.candidateName) {
      return [];
    }

    const editorialTextMatch = findEditorialMatch(face.candidateName, sourceText);
    const isAccepted = editorialTextMatch.matched || (face.confidence ?? 0) >= autoApproveThreshold;

    return [{
      aiResponse: {
        confidence: face.confidence ?? 0,
        detectedName: face.candidateName,
      },
      canonicalName: face.candidateName,
      editorialTextMatch,
      faceNumber: index + 1,
      identificationSource: editorialTextMatch.matched
        ? "AI image recognition only + Meta" as const
        : "AI image recognition only" as const,
      providerPersonId: face.providerPersonId,
      searchDecision: isAccepted ? "Accepted" as const : "Needs Review" as const,
      status: isAccepted ? "Approved" as const : "Needs Review" as const,
    }];
  });

  if (celebrities.length > 0) {
    return { celebrities, designers: [] };
  }

  const metadataAssociation = parseMetadataOnlyAssociation(sourceText);
  if (!metadataAssociation) {
    return { celebrities: [], designers: [] };
  }

  return {
    celebrities: [{
      aiResponse: null,
      canonicalName: metadataAssociation.celebrity,
      editorialTextMatch: { matched: true, source: metadataAssociation.source },
      faceNumber: null,
      identificationSource: "Meta Only",
      providerPersonId: null,
      searchDecision: "Accepted",
      status: "Approved",
    }],
    designers: [{
      evidence: `${metadataAssociation.source} · ${metadataAssociation.celebrity}`,
      name: metadataAssociation.designer,
    }],
  };
}

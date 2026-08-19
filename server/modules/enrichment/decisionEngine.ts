import type { RecognitionResult } from "../../../shared/contracts/recognition.js";
import type { AssetCelebrityAssociation } from "../../repositories/AssetRepository.js";
import type { CelebrityCatalogEntry } from "../../repositories/CelebrityRepository.js";

export const CELEBRITY_DECISION_ENGINE_VERSION = 1;

export interface CelebrityDecisionInput {
  approvalThreshold: number;
  catalog: readonly CelebrityCatalogEntry[];
  recognitionResult: RecognitionResult | null;
  sourceText: {
    altText: string | null;
    backstory: string | null;
    caption: string | null;
    title: string | null;
  };
}

export interface CelebrityDecisionResult {
  associations: AssetCelebrityAssociation[];
  decisionEngineVersion: typeof CELEBRITY_DECISION_ENGINE_VERSION;
  searchReady: boolean;
}

type EvidenceField = AssetCelebrityAssociation["evidenceFields"][number];

export function evaluateCelebrityDecisions({
  approvalThreshold,
  catalog,
  recognitionResult,
  sourceText,
}: CelebrityDecisionInput): CelebrityDecisionResult {
  const catalogIndex = createCatalogIndex(catalog);
  const associations = new Map<string, AssetCelebrityAssociation>();

  for (const face of recognitionResult?.faces ?? []) {
    const catalogEntry = resolveRecognizedCelebrity(
      catalogIndex,
      recognitionResult!.provider,
      face.providerPersonId,
      face.candidateName,
    );
    const candidateName = cleanDisplayName(face.candidateName);
    const displayName = catalogEntry?.displayName ?? candidateName;
    if (!displayName) {
      continue;
    }

    const identityKey = catalogEntry?.slug ?? createIdentityKey(displayName);
    if (!identityKey) {
      continue;
    }
    const evidenceFields = findEvidenceFields(sourceText, [
      displayName,
      face.candidateName,
      catalogEntry?.normalizedName,
      ...(catalogEntry?.normalizedAliases ?? []),
    ]);
    const approvedByConfidence =
      face.confidence !== null && face.confidence >= approvalThreshold;
    mergeAssociation(associations, {
      confidence: face.confidence,
      decision:
        approvedByConfidence || evidenceFields.length > 0 ? "APPROVED" : "NEEDS_REVIEW",
      displayName,
      evidenceFields,
      identityKey,
      providerPersonId: face.providerPersonId,
      source: "recognition",
    });
  }

  // Metadata-only inference is deliberately narrow. It is used only when the
  // provider returned no usable celebrity candidate, and only when the text
  // starts with a catalog identity followed by "in".
  if (associations.size === 0 && recognitionResult !== null) {
    for (const field of ["title", "caption"] as const) {
      const catalogEntry = resolveMetadataInference(catalogIndex, sourceText[field]);
      if (!catalogEntry) {
        continue;
      }

      mergeAssociation(associations, {
        confidence: null,
        decision: "APPROVED",
        displayName: catalogEntry.displayName,
        evidenceFields: [field],
        identityKey: catalogEntry.slug,
        providerPersonId: null,
        source: "metadata-inference",
      });
    }
  }

  const result = [...associations.values()];
  return {
    associations: result,
    decisionEngineVersion: CELEBRITY_DECISION_ENGINE_VERSION,
    searchReady: result.some(({ decision }) => decision === "APPROVED"),
  };
}

interface CatalogIndex {
  byName: Map<string, CelebrityCatalogEntry>;
  byProviderIdentity: Map<string, CelebrityCatalogEntry>;
}

function createCatalogIndex(catalog: readonly CelebrityCatalogEntry[]): CatalogIndex {
  const byName = new Map<string, CelebrityCatalogEntry>();
  const byProviderIdentity = new Map<string, CelebrityCatalogEntry>();

  for (const entry of catalog) {
    for (const name of [
      entry.displayName,
      entry.normalizedName,
      ...(entry.normalizedAliases ?? []),
    ]) {
      const normalized = normalizeIdentityText(name);
      if (normalized) {
        byName.set(normalized, entry);
      }
    }
    for (const identity of entry.providerIdentities ?? []) {
      byProviderIdentity.set(`${identity.provider}:${identity.personId}`, entry);
    }
  }

  return { byName, byProviderIdentity };
}

function resolveRecognizedCelebrity(
  catalog: CatalogIndex,
  provider: RecognitionResult["provider"],
  providerPersonId: string | null,
  candidateName: string | null,
): CelebrityCatalogEntry | undefined {
  if (providerPersonId) {
    const providerMatch = catalog.byProviderIdentity.get(`${provider}:${providerPersonId}`);
    if (providerMatch) {
      return providerMatch;
    }
  }

  return candidateName ? catalog.byName.get(normalizeIdentityText(candidateName)) : undefined;
}

function resolveMetadataInference(
  catalog: CatalogIndex,
  value: string | null,
): CelebrityCatalogEntry | undefined {
  const normalized = normalizeIdentityText(value);
  const separatorIndex = normalized.indexOf(" in ");
  if (separatorIndex <= 0) {
    return undefined;
  }

  return catalog.byName.get(normalized.slice(0, separatorIndex).trim());
}

function findEvidenceFields(
  sourceText: CelebrityDecisionInput["sourceText"],
  candidateNames: Array<string | null | undefined>,
): EvidenceField[] {
  const names = new Set(
    candidateNames
      .map((name) => normalizeIdentityText(name))
      .filter((name) => name.length > 0),
  );

  return (["title", "caption"] as const).filter((field) => {
    const normalizedText = ` ${normalizeIdentityText(sourceText[field])} `;
    return [...names].some((name) => normalizedText.includes(` ${name} `));
  });
}

function mergeAssociation(
  associations: Map<string, AssetCelebrityAssociation>,
  candidate: AssetCelebrityAssociation,
): void {
  const existing = associations.get(candidate.identityKey);
  if (!existing) {
    associations.set(candidate.identityKey, candidate);
    return;
  }

  const confidence = Math.max(existing.confidence ?? -1, candidate.confidence ?? -1);
  associations.set(candidate.identityKey, {
    confidence: confidence < 0 ? null : confidence,
    decision:
      existing.decision === "APPROVED" || candidate.decision === "APPROVED"
        ? "APPROVED"
        : "NEEDS_REVIEW",
    displayName: existing.displayName,
    evidenceFields: (["title", "caption"] as const).filter(
      (field) =>
        existing.evidenceFields.includes(field) || candidate.evidenceFields.includes(field),
    ),
    identityKey: existing.identityKey,
    providerPersonId: existing.providerPersonId ?? candidate.providerPersonId,
    source:
      existing.source === "recognition" || candidate.source === "recognition"
        ? "recognition"
        : "metadata-inference",
  });
}

function cleanDisplayName(value: string | null): string | null {
  const cleaned = value?.replace(/\s+/gu, " ").trim();
  return cleaned || null;
}

export function normalizeIdentityText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function createIdentityKey(displayName: string): string {
  return normalizeIdentityText(displayName).replaceAll(" ", "-");
}

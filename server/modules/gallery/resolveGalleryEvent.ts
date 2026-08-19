import {
  canonicalEventNames,
  type CanonicalEventId,
  type GalleryEventContext,
} from "../../../shared/galleries.js";

export type GalleryEventResolution =
  | { status: "RESOLVED"; event: GalleryEventContext }
  | { status: "UNKNOWN" }
  | { status: "AMBIGUOUS" };

interface EventDefinition {
  id: CanonicalEventId;
  pattern: RegExp;
}

const eventDefinitions: readonly EventDefinition[] = [
  { id: "met-gala", pattern: /\bmet gala\b/u },
  { id: "grammys", pattern: /\bgrammy(?: awards|s)?\b/u },
  { id: "oscars", pattern: /\b(?:academy awards|oscars?)\b/u },
  { id: "golden-globes", pattern: /\bgolden globes?\b/u },
  { id: "vogue-world", pattern: /\bvogue world\b/u },
];

const eventYearPattern = /\b(?:19|20|21)\d{2}\b/gu;

export function resolveGalleryEvent(tags: readonly string[]): GalleryEventResolution {
  const candidates = new Map<string, GalleryEventContext>();

  for (const tag of tags) {
    const normalizedTag = normalizeTag(tag);
    const years = [...normalizedTag.matchAll(eventYearPattern)].map((match) => Number(match[0]));
    if (years.length === 0) {
      continue;
    }

    for (const definition of eventDefinitions) {
      if (!definition.pattern.test(normalizedTag)) {
        continue;
      }

      for (const year of years) {
        const event = {
          id: definition.id,
          name: canonicalEventNames[definition.id],
          year,
        };
        candidates.set(`${event.id}:${event.year}`, event);
      }
    }
  }

  if (candidates.size === 0) {
    return { status: "UNKNOWN" };
  }

  if (candidates.size > 1) {
    return { status: "AMBIGUOUS" };
  }

  return { status: "RESOLVED", event: [...candidates.values()][0] };
}

function normalizeTag(tag: string): string {
  return tag
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

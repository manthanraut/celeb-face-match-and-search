export type IdentificationSource =
  | "AI_image recognition only"
  | "AI_image recognition only + Meta"
  | "Meta Only";

export type CelebrityStatus = "Approved" | "Needs Review";
export type EditorialMatchSource = "caption" | "title" | "both caption and title";

export type ArchiveFeaturedContent = {
  title: string;
  url: string;
};

export type ArchiveCelebrity = {
  canonical_name: string;
  identification_source: IdentificationSource;
  status: CelebrityStatus;
  AIresponse: {
    detected_name: string;
    confidence: number;
  };
  editorial_text_match: {
    matched: boolean;
    source: EditorialMatchSource | null;
  };
};

export type ArchiveImage = {
  image_id: string;
  image_url: string;
  source_text: {
    title: string | null;
    caption: string | null;
    alt_text: string | null;
    backstory: string | null;
  };
  featured_in: ArchiveFeaturedContent[];
  celebrities: ArchiveCelebrity[];
  designers: unknown[];
  usages: Array<{
    event: {
      event_id: string | null;
      event_name: string | null;
      year: number | null;
    };
    added_at: string;
  }>;
  enrichment_state: {
    image_recognition_complete: boolean;
    editorial_metadata_processed: boolean;
    gallery_context_available: boolean;
    search_ready: boolean;
  };
};

const celebrityNames = [
  "Tracee Ellis Ross",
  "Emilia Clarke",
  "Catherine",
  "Rihanna",
  "Zendaya",
  "Naomi Campbell",
] as const;

const archiveEvents = [
  { id: "met-gala", name: "Met Gala" },
  { id: "oscars", name: "Oscars" },
  { id: "vogue-world", name: "Vogue World" },
  { id: "golden-globes", name: "Golden Globes" },
  null,
] as const;

const archiveYears = [2026, 2025, 2024, 2023, null] as const;

const sampleFeaturedContent: readonly ArchiveFeaturedContent[] = [
  {
    title: "Met Gala 2026: Red Carpet Celebrity Arrivals",
    url: "https://www.vogue.com/slideshow/met-gala-2026-red-carpet-celebrity-arrivals-live",
  },
  {
    title: "Met Gala 2025: The Red Carpet",
    url: "https://www.vogue.com/slideshow/met-gala-2025-red-carpet",
  },
];

const photoIds = [
  "1534528741775-53994a69daeb", "1488426862026-3ee34a7d66df", "1529139574466-a303027c1d8b",
  "1524250502761-1ac6f2e30d43", "1508214751196-bcfd4ca60f91", "1531123897727-8f129e1688ce",
  "1529626455594-4ff0802cfb7e", "1524504388940-b1c1722653e1", "1517841905240-472988babdf9",
  "1544005313-94ddf0286df2", "1531746020798-e6953c6e8e04", "1506794778202-cad84cf45f1d",
  "1539571696357-5a69c17a67c6", "1500648767791-00dcc994a43e", "1521119989659-a83eee488004",
] as const;

export const sampleArchiveImages: ArchiveImage[] = celebrityNames.flatMap(
  (canonicalName, celebrityIndex) =>
    Array.from({ length: 50 }, (_, photoIndex) => {
      const imageNumber = celebrityIndex * 50 + photoIndex + 1;
      const event =
        archiveEvents[(photoIndex + celebrityIndex) % archiveEvents.length];
      const year =
        archiveYears[(photoIndex + celebrityIndex * 2) % archiveYears.length];
      const occasion = event?.name ?? "a Vogue archive event";
      const dateContext = year ? ` in ${year}` : "";

      return {
        image_id: `img_${String(imageNumber).padStart(3, "0")}`,
        image_url: `https://images.unsplash.com/photo-${photoIds[(photoIndex + celebrityIndex * 5) % photoIds.length]}?w=800&h=1000&fit=crop&crop=faces&v=${photoIndex}`,
        source_text: {
          title:
            photoIndex % 3 === 0
              ? `${canonicalName} at ${occasion}`
              : null,
          caption:
            photoIndex % 3 === 0
              ? `${canonicalName} photographed at ${occasion}${dateContext}.`
              : null,
          alt_text: `${canonicalName} at ${occasion}`,
          backstory: `${canonicalName} was photographed at ${occasion}${dateContext}. This archive image preserves an editor-supplied note about the moment and its place in Vogue’s event coverage.`,
        },
        featured_in: [...sampleFeaturedContent],
        celebrities: [
          {
            canonical_name: canonicalName,
            identification_source:
              photoIndex % 3 === 0
                ? "AI_image recognition only + Meta"
                : "AI_image recognition only",
            status: "Approved",
            AIresponse: {
              detected_name: canonicalName,
              confidence: Number((96 + (photoIndex % 30) / 10).toFixed(1)),
            },
            editorial_text_match: {
              matched: photoIndex % 3 === 0,
              source: photoIndex % 3 === 0 ? "both caption and title" : null,
            },
          },
        ],
        designers: [],
        usages: [
          {
            event: {
              event_id: event?.id ?? null,
              event_name: event?.name ?? null,
              year,
            },
            added_at: `${year ?? 2026}-05-04T21:14:32Z`,
          },
        ],
        enrichment_state: {
          image_recognition_complete: true,
          editorial_metadata_processed: photoIndex % 3 === 0,
          gallery_context_available: true,
          search_ready: true,
        },
      } satisfies ArchiveImage;
    }),
);

import type {
  VersoCelebrity,
  VersoSearchAsset,
} from "../../../shared/search.js";

export type FeaturedContentLink = {
  title: string;
  url: string;
};

// Temporary presentation fixtures until Featured In relationships are exposed
// by the backend. Keep these separate from API-mapped fields.
const featuredContentFixtures: readonly FeaturedContentLink[] = [
  {
    title: "Met Gala 2026: Red Carpet Celebrity Arrivals",
    url: "https://www.vogue.com/slideshow/met-gala-2026-red-carpet-celebrity-arrivals-live",
  },
  {
    title: "Met Gala 2025: The Red Carpet",
    url: "https://www.vogue.com/slideshow/met-gala-2025-red-carpet",
  },
];

export type DiscoveryImageDetails = {
  altText: string;
  assetId: string;
  backStory: string | null;
  caption: string | null;
  celebrityName: string;
  eventName: string | null;
  featuredIn: readonly FeaturedContentLink[];
  id: string;
  imageUrl: string;
  title: string | null;
  year: number | null;
};

export function toDiscoveryImageDetails(
  asset: VersoSearchAsset,
  celebrity: VersoCelebrity,
): DiscoveryImageDetails {
  return {
    altText:
      asset.sourceText.altText ??
      asset.sourceText.caption ??
      asset.sourceText.title ??
      `${celebrity.displayName} photographed for the Vogue image archive`,
    assetId: asset.assetId,
    backStory: asset.sourceText.backstory ?? null,
    caption: asset.sourceText.caption,
    celebrityName: celebrity.displayName,
    eventName: asset.event?.name ?? null,
    featuredIn: featuredContentFixtures,
    id: `${asset.assetId}:${asset.sourceGallery.galleryId}`,
    imageUrl: asset.links.image,
    title: asset.sourceText.title,
    year: asset.event?.year ?? null,
  };
}

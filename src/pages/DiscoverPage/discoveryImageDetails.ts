import type {
  ArchiveCelebrity,
  ArchiveImage,
} from "../../data/sampleArchive.js";

export type FeaturedContentLink = {
  title: string;
  url: string;
};

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
  year: number | null;
};

export function toDiscoveryImageDetails(
  image: ArchiveImage,
  celebrity: ArchiveCelebrity,
): DiscoveryImageDetails {
  const usage = image.usages[0];
  const event = usage?.event;

  return {
    altText:
      image.source_text.alt_text ??
      `${celebrity.canonical_name} photographed for the Vogue image archive`,
    assetId: image.image_id,
    backStory: image.source_text.backstory,
    caption: image.source_text.caption,
    celebrityName: celebrity.canonical_name,
    eventName: event?.event_name ?? null,
    featuredIn: image.featured_in,
    id: [
      image.image_id,
      event?.event_id ?? "no-event",
      event?.year ?? "no-year",
    ].join(":"),
    imageUrl: image.image_url,
    year: event?.year ?? null,
  };
}

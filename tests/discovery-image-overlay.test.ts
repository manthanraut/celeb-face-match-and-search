import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { VersoCelebrity, VersoSearchAsset } from "../shared/search.js";
import { DiscoveryImageCard } from "../src/pages/DiscoverPage/DiscoveryImageCard.js";
import { DiscoveryImageDialog } from "../src/pages/DiscoverPage/DiscoveryImageDialog.js";
import { toDiscoveryImageDetails } from "../src/pages/DiscoverPage/discoveryImageDetails.js";

const celebrity: VersoCelebrity = {
  displayName: "Rihanna",
  slug: "rihanna",
};

const searchAsset: VersoSearchAsset = {
  assetId: "64b000000000000000000001",
  celebrities: [celebrity],
  event: {
    id: "met-gala",
    name: "Met Gala",
    year: 2026,
  },
  links: {
    image: "/api/assets/64b000000000000000000001/image",
    self: "/api/assets/64b000000000000000000001",
  },
  mimeType: "image/jpeg",
  originalFilename: "rihanna-met-gala.jpg",
  sourceGallery: {
    addedAt: "2026-05-04T21:14:32.000Z",
    galleryId: "met-gala-2026",
  },
  sourceText: {
    altText: "Rihanna on the Met Gala red carpet",
    backstory: "An editor-provided note from the Met Gala red carpet.",
    caption: "Rihanna arrives at the Met Gala.",
    title: "Rihanna in Marc Jacobs",
  },
};

describe("discovery image overlay", () => {
  it("shows the backstory indicator only when backstory content is available", () => {
    const details = toDiscoveryImageDetails(searchAsset, celebrity);
    const renderCard = (backStory: string | null) =>
      renderToStaticMarkup(
        createElement(DiscoveryImageCard, {
          children: null,
          details: { ...details, backStory },
          onOpen() {},
        }),
      );

    expect(renderCard("An editor-provided archive note.")).toContain(
      "backstory available",
    );
    expect(renderCard(null)).not.toContain("backstory available");
    expect(renderCard("   ")).not.toContain("backstory available");
  });

  it("maps API backstory and keeps temporary Featured In fixtures", () => {
    const details = toDiscoveryImageDetails(searchAsset, celebrity);

    expect(details).toEqual({
      altText: searchAsset.sourceText.altText,
      assetId: searchAsset.assetId,
      backStory: searchAsset.sourceText.backstory,
      caption: searchAsset.sourceText.caption,
      celebrityName: celebrity.displayName,
      eventName: searchAsset.event?.name,
      featuredIn: [
        {
          title: "Met Gala 2026: Red Carpet Celebrity Arrivals",
          url: "https://www.vogue.com/slideshow/met-gala-2026-red-carpet-celebrity-arrivals-live",
        },
        {
          title: "Met Gala 2025: The Red Carpet",
          url: "https://www.vogue.com/slideshow/met-gala-2025-red-carpet",
        },
      ],
      id: `${searchAsset.assetId}:${searchAsset.sourceGallery.galleryId}`,
      imageUrl: searchAsset.links.image,
      title: searchAsset.sourceText.title,
      year: searchAsset.event?.year,
    });
  });

  it("uses a useful alt-text fallback when the API has no editorial alt text", () => {
    const details = toDiscoveryImageDetails(
      {
        ...searchAsset,
        sourceText: { ...searchAsset.sourceText, altText: null },
      },
      celebrity,
    );

    expect(details.altText).toContain(celebrity.displayName);
    expect(details.altText.trim()).not.toBe("");
  });

  it("renders API backstory and the two temporary Featured In links", () => {
    const details = toDiscoveryImageDetails(searchAsset, celebrity);
    const markup = renderToStaticMarkup(
      createElement(DiscoveryImageDialog, {
        details,
        onDismiss() {},
      }),
    );

    expect(markup).toContain("Close image details");
    expect(markup).toContain(details.celebrityName);
    expect(markup).toContain(details.eventName ?? "—");
    expect(markup).toContain(String(details.year ?? "—"));
    expect(markup).toContain("Featured In");
    expect(markup).toContain("Met Gala 2026: Red Carpet Celebrity Arrivals");
    expect(markup).toContain("Met Gala 2025: The Red Carpet");
    expect(markup).toContain(searchAsset.sourceText.backstory ?? "");
  });
});

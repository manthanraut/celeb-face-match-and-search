import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sampleArchiveImages } from "../src/data/sampleArchive.js";
import { DiscoveryImageCard } from "../src/pages/DiscoverPage/DiscoveryImageCard.js";
import { DiscoveryImageDialog } from "../src/pages/DiscoverPage/DiscoveryImageDialog.js";
import { toDiscoveryImageDetails } from "../src/pages/DiscoverPage/discoveryImageDetails.js";

describe("discovery image overlay", () => {
  it("shows the backstory indicator only when backstory content is available", () => {
    const image = sampleArchiveImages[0];
    const celebrity = image?.celebrities[0];
    if (!image || !celebrity) throw new Error("Expected sample archive data.");

    const details = toDiscoveryImageDetails(image, celebrity);
    const renderCard = (backStory: string | null) =>
      renderToStaticMarkup(
        createElement(DiscoveryImageCard, {
          children: null,
          details: { ...details, backStory },
          onOpen() {},
        }),
      );

    expect(renderCard(details.backStory)).toContain("backstory available");
    expect(renderCard(null)).not.toContain("backstory available");
    expect(renderCard("   ")).not.toContain("backstory available");
  });

  it("maps selected archive data without changing backend-provided values", () => {
    const image = sampleArchiveImages[0];
    const celebrity = image?.celebrities[0];
    if (!image || !celebrity) throw new Error("Expected sample archive data.");

    const details = toDiscoveryImageDetails(image, celebrity);

    expect(details).toMatchObject({
      altText: image.source_text.alt_text,
      assetId: image.image_id,
      backStory: image.source_text.backstory,
      celebrityName: celebrity.canonical_name,
      eventName: image.usages[0]?.event.event_name,
      featuredIn: image.featured_in,
      imageUrl: image.image_url,
      year: image.usages[0]?.event.year,
    });
  });

  it("keeps demo event and year values within the Copilot response options", () => {
    const allowedEvents = new Set([
      "Met Gala",
      "Oscars",
      "Vogue World",
      "Golden Globes",
      null,
    ]);
    const allowedYears = new Set([2026, 2025, 2024, 2023, null]);

    for (const image of sampleArchiveImages) {
      expect(allowedEvents.has(image.usages[0]?.event.event_name ?? null)).toBe(
        true,
      );
      expect(allowedYears.has(image.usages[0]?.event.year ?? null)).toBe(true);
      expect(image.featured_in).toHaveLength(2);
      expect(image.source_text.backstory).not.toBeNull();
    }
  });

  it("renders the selected image details and two Featured In links", () => {
    const image = sampleArchiveImages[0];
    const celebrity = image?.celebrities[0];
    if (!image || !celebrity) throw new Error("Expected sample archive data.");

    const details = toDiscoveryImageDetails(image, celebrity);
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
    expect(markup).toContain(details.featuredIn[0]?.title);
    expect(markup).toContain(details.featuredIn[1]?.title);
    expect(markup).toContain(details.backStory);
  });
});

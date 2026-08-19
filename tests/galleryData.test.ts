import { describe, expect, it } from "vitest";

import { gallery } from "../src/surfaces/verso/pages/GalleryPage/galleryData.js";

describe("gallery sample data", () => {
  it("provides ten unique, captioned slideshow images", () => {
    expect(gallery.images).toHaveLength(10);
    expect(new Set(gallery.images.map(({ id }) => id)).size).toBe(10);

    for (const image of gallery.images) {
      expect(image.alt.length).toBeGreaterThan(0);
      expect(image.caption.length).toBeGreaterThan(0);
      expect(image.src).toContain(image.id);
    }
  });
});

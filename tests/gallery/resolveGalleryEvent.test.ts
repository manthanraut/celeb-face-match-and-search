import { describe, expect, it } from "vitest";

import { resolveGalleryEvent } from "../../server/modules/gallery/resolveGalleryEvent.js";

describe("resolveGalleryEvent", () => {
  it.each([
    ["Met Gala 2027", "met-gala", "Met Gala", 2027],
    ["GRAMMY AWARDS: 2026", "grammys", "Grammys", 2026],
    ["Oscars_2025", "oscars", "Oscars", 2025],
    ["Academy Awards / 2024", "oscars", "Oscars", 2024],
    ["Golden Globe 2023", "golden-globes", "Golden Globe", 2023],
    ["Vogue—World—2022", "vogue-world", "Vogue World", 2022],
  ])("resolves %s to canonical event context", (tag, id, name, year) => {
    expect(resolveGalleryEvent([tag])).toEqual({
      status: "RESOLVED",
      event: { id, name, year },
    });
  });

  it("ignores unrelated tags and duplicate forms of the same event context", () => {
    expect(
      resolveGalleryEvent([
        "fashion",
        "storytype:news-and-trending",
        "met gala 2027",
        "Met-Gala-2027",
      ]),
    ).toEqual({
      status: "RESOLVED",
      event: { id: "met-gala", name: "Met Gala", year: 2027 },
    });
  });

  it("does not combine an event tag with a year from another tag", () => {
    expect(resolveGalleryEvent(["Met Gala", "2027", "fashion"])).toEqual({
      status: "UNKNOWN",
    });
  });

  it("returns unknown for unsupported events", () => {
    expect(resolveGalleryEvent(["Cannes Film Festival 2027"])).toEqual({
      status: "UNKNOWN",
    });
  });

  it("rejects conflicting event context instead of selecting by tag order", () => {
    expect(resolveGalleryEvent(["Met Gala 2027", "Oscars 2027"])).toEqual({
      status: "AMBIGUOUS",
    });
    expect(resolveGalleryEvent(["Met Gala 2026", "Met Gala 2027"])).toEqual({
      status: "AMBIGUOUS",
    });
  });
});

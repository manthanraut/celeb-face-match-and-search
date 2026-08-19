import type { Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import {
  DEMO_CELEBRITY_CATALOG,
  ensureDemoCelebrityCatalog,
} from "../../server/database/demoCelebrityCatalog.js";

describe("demo celebrity catalog", () => {
  it("contains the canonical Doja Cat identity", () => {
    expect(DEMO_CELEBRITY_CATALOG).toContainEqual({
      displayName: "Doja Cat",
      normalizedAliases: [],
      normalizedName: "doja cat",
      providerIdentities: [],
      slug: "doja-cat",
    });
  });

  it("seeds each identity without overwriting an existing catalog record", async () => {
    const bulkWrite = vi.fn(async () => ({ acknowledged: true }));
    const database = {
      collection: vi.fn(() => ({ bulkWrite })),
    } as unknown as Db;

    await ensureDemoCelebrityCatalog(database);

    expect(bulkWrite).toHaveBeenCalledOnce();
    expect(bulkWrite).toHaveBeenCalledWith(
      DEMO_CELEBRITY_CATALOG.map((celebrity) => ({
        updateOne: {
          filter: { slug: celebrity.slug },
          update: { $setOnInsert: celebrity },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  });
});

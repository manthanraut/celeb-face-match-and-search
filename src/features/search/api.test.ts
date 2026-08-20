import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CelebritySearchResponse,
  DiscoveryHubResponse,
  VersoCelebrity,
  VersoSearchAsset,
} from "../../../shared/search";
import {
  getCelebritySearch,
  getDiscoveryHub,
  SearchApiError,
} from "./api";

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
    backstory: "An editor-provided archive note.",
    caption: "Rihanna arrives at the Met Gala.",
    title: "Rihanna in Marc Jacobs",
  },
};

const searchResponse: CelebritySearchResponse = {
  celebrity,
  items: [searchAsset],
  nextCursor: "next/cursor?value=1",
  query: "Rihanna",
  total_count: 1,
};

const hubResponse: DiscoveryHubResponse = {
  people: [
    {
      celebrity,
      representativeImage: searchAsset,
      total_count: 1,
    },
  ],
  suggestedSearches: [celebrity],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("search API client", () => {
  it("normalizes and serializes every supported celebrity search parameter", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(searchResponse));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getCelebritySearch(
        {
          cursor: "next/cursor?value=1",
          event: "met-gala",
          limit: 12,
          query: "  Rihanna  ",
          year: 2026,
        },
        controller.signal,
      ),
    ).resolves.toEqual(searchResponse);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestOptions] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const url = new URL(requestUrl, "http://localhost");
    expect(url.pathname).toBe("/api/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cursor: "next/cursor?value=1",
      event: "met-gala",
      limit: "12",
      query: "Rihanna",
      year: "2026",
    });
    expect(requestOptions.signal).toBe(controller.signal);
  });

  it("uses the shared default page size and rejects invalid searches before fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(searchResponse));
    vi.stubGlobal("fetch", fetchMock);

    await getCelebritySearch({ query: "Rihanna" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/search?limit=20&query=Rihanna",
      { signal: undefined },
    );

    await expect(
      getCelebritySearch({ limit: 101, query: "Rihanna" }),
    ).rejects.toThrow();
    await expect(getCelebritySearch({ query: "   " })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loads and validates the discovery hub contract", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(hubResponse));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDiscoveryHub(7, controller.signal)).resolves.toEqual(
      hubResponse,
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/discovery?limit=7", {
      signal: controller.signal,
    });
  });

  it("rejects an invalid discovery hub limit before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDiscoveryHub(21)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed success responses instead of leaking invalid data to pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          celebrity,
          items: [{ ...searchAsset, assetId: "not-an-asset-id" }],
          nextCursor: null,
          query: "Rihanna",
          total_count: 1,
        }),
      ),
    );

    await expect(getCelebritySearch({ query: "Rihanna" })).rejects.toThrow();
  });

  it("rejects search responses that omit the backstory contract field", async () => {
    const invalidAsset = structuredClone(searchAsset) as Record<string, unknown>;
    const sourceText = invalidAsset.sourceText as Record<string, unknown>;
    Reflect.deleteProperty(sourceText, "backstory");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({
        ...searchResponse,
        items: [invalidAsset],
      })),
    );

    await expect(getCelebritySearch({ query: "Rihanna" })).rejects.toThrow();
  });

  it("surfaces the standard API error code, message, and status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "AMBIGUOUS_CELEBRITY_QUERY",
              message: "The search query matches more than one celebrity.",
            },
          },
          409,
        ),
      ),
    );

    const error = await getCelebritySearch({ query: "Rihanna" }).catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(SearchApiError);
    expect(error).toMatchObject({
      code: "AMBIGUOUS_CELEBRITY_QUERY",
      message: "The search query matches more than one celebrity.",
      status: 409,
    });
  });

  it("uses a safe fallback for non-JSON API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Service unavailable", {
          headers: { "Content-Type": "text/plain" },
          status: 503,
        }),
      ),
    );

    await expect(getDiscoveryHub()).rejects.toMatchObject({
      code: null,
      message: "Request failed with status 503.",
      status: 503,
    });
  });
});

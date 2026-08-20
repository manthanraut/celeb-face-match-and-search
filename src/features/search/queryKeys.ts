import type { CelebritySearchRequest } from "./api";

type CelebritySearchFilters = Omit<CelebritySearchRequest, "cursor">;

export const searchQueryKeys = {
  all: ["verso-search"] as const,
  celebrity: (filters: CelebritySearchFilters) => [
    ...searchQueryKeys.all,
    "celebrity",
    filters,
  ] as const,
  discoveryHub: (limit: number) => [
    ...searchQueryKeys.all,
    "discovery-hub",
    limit,
  ] as const,
};

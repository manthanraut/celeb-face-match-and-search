import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from "@tanstack/react-query";

import type { CelebritySearchResponse } from "../../../shared/search";

import {
  getCelebritySearch,
  getDiscoveryHub,
  SearchApiError,
  type CelebritySearchRequest,
} from "./api";
import { searchQueryKeys } from "./queryKeys";

type CelebritySearchFilters = Omit<CelebritySearchRequest, "cursor">;

function shouldRetry(failureCount: number, error: Error) {
  if (error instanceof SearchApiError && error.status < 500) return false;
  return failureCount < 1;
}

export function useCelebritySearch(
  filters: CelebritySearchFilters,
  enabled = true,
) {
  return useInfiniteQuery<
    CelebritySearchResponse,
    Error,
    InfiniteData<CelebritySearchResponse, string | undefined>,
    ReturnType<typeof searchQueryKeys.celebrity>,
    string | undefined
  >({
    enabled: enabled && Boolean(filters.query.trim()),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getCelebritySearch({
      ...filters,
      ...(pageParam ? { cursor: pageParam } : {}),
    }, signal),
    queryKey: searchQueryKeys.celebrity(filters),
    retry: shouldRetry,
  });
}

export function useDiscoveryHub(limit = 10) {
  return useQuery({
    queryFn: ({ signal }) => getDiscoveryHub(limit, signal),
    queryKey: searchQueryKeys.discoveryHub(limit),
    retry: shouldRetry,
  });
}

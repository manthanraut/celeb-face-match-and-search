import type { CanonicalEventId } from "../../../shared/galleries";
import {
  celebritySearchQuerySchema,
  celebritySearchResponseSchema,
  discoveryHubQuerySchema,
  discoveryHubResponseSchema,
  type CelebritySearchResponse,
  type DiscoveryHubResponse,
} from "../../../shared/search";

export type CelebritySearchRequest = {
  cursor?: string;
  event?: CanonicalEventId;
  limit?: number;
  query: string;
  year?: number;
};

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class SearchApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "SearchApiError";
    this.code = code;
    this.status = status;
  }
}

async function toSearchApiError(response: Response): Promise<SearchApiError> {
  try {
    const body = await response.json() as ApiErrorEnvelope;
    return new SearchApiError(
      body.error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      body.error?.code ?? null,
    );
  } catch {
    return new SearchApiError(
      `Request failed with status ${response.status}.`,
      response.status,
    );
  }
}

export async function getCelebritySearch(
  request: CelebritySearchRequest,
  signal?: AbortSignal,
): Promise<CelebritySearchResponse> {
  const query = celebritySearchQuerySchema.parse(request);
  const searchParams = new URLSearchParams({
    limit: String(query.limit),
    query: query.query,
  });

  if (query.cursor) searchParams.set("cursor", query.cursor);
  if (query.event) searchParams.set("event", query.event);
  if (query.year !== undefined) searchParams.set("year", String(query.year));

  const response = await fetch(`/api/search?${searchParams}`, { signal });
  if (!response.ok) throw await toSearchApiError(response);

  return celebritySearchResponseSchema.parse(await response.json());
}

export async function getDiscoveryHub(
  limit = 10,
  signal?: AbortSignal,
): Promise<DiscoveryHubResponse> {
  const query = discoveryHubQuerySchema.parse({ limit });
  const searchParams = new URLSearchParams({ limit: String(query.limit) });
  const response = await fetch(`/api/discovery?${searchParams}`, { signal });
  if (!response.ok) throw await toSearchApiError(response);

  return discoveryHubResponseSchema.parse(await response.json());
}

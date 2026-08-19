import {
  assetDetailSchema,
  assetUploadResponseSchema,
  type AssetDetail,
  type AssetMetadataUpdate,
  type AssetUploadResponse,
} from "../../../shared/assets";

export interface AssetUploadInput {
  clientAssetId: string;
  file: File;
}

export class AssetApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AssetApiError";
    this.status = status;
  }
}

export function assetQueryKey(assetId: string) {
  return ["asset", assetId] as const;
}

export async function uploadAssets(inputs: readonly AssetUploadInput[]): Promise<AssetUploadResponse> {
  const body = new FormData();
  inputs.forEach(({ file }) => body.append("images", file, file.name));
  body.append(
    "manifest",
    JSON.stringify(inputs.map(({ clientAssetId }) => ({ clientAssetId }))),
  );

  const response = await fetch("/api/assets", {
    body,
    method: "POST",
  });

  return parseJsonResponse(response, (value) => assetUploadResponseSchema.parse(value));
}

export async function getAsset(assetId: string): Promise<AssetDetail> {
  const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`);
  return parseJsonResponse(response, (value) => assetDetailSchema.parse(value));
}

export async function updateAssetMetadata(
  assetId: string,
  metadata: AssetMetadataUpdate,
): Promise<AssetDetail> {
  const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}/metadata`, {
    body: JSON.stringify(metadata),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });

  return parseJsonResponse(response, (value) => assetDetailSchema.parse(value));
}

async function parseJsonResponse<T>(
  response: Response,
  parse: (value: unknown) => T,
): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AssetApiError(response.status, "The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new AssetApiError(response.status, readApiErrorMessage(body));
  }

  return parse(body);
}

function readApiErrorMessage(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "message" in value.error &&
    typeof value.error.message === "string"
  ) {
    return value.error.message;
  }

  return "The server could not complete the request.";
}

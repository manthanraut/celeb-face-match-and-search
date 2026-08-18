import {
  photoAssetResponseSchema,
  type PhotoAsset,
  type PhotoAssetResponse,
  type UpdateSourceTextInput,
} from "../../../shared/contracts/assets";

interface UploadPhotoAssetInput {
  file: File;
  height: number;
  width: number;
}

async function readError(response: Response) {
  try {
    const body = await response.json() as { error?: string };
    return body.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

async function parseAssetResponse(response: Response) {
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return photoAssetResponseSchema.parse(await response.json());
}

export async function getPhotoAsset(assetId: string) {
  return parseAssetResponse(await fetch(`/api/assets/${assetId}`));
}

export async function uploadPhotoAsset(input: UploadPhotoAssetInput): Promise<PhotoAsset> {
  const response = await fetch("/api/assets", {
    body: input.file,
    headers: {
      "Content-Type": input.file.type,
      "X-File-Last-Modified": String(input.file.lastModified),
      "X-File-Name": encodeURIComponent(input.file.name),
      "X-Image-Height": String(input.height),
      "X-Image-Width": String(input.width),
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const body = await response.json() as { asset: unknown };
  return photoAssetResponseSchema.shape.asset.parse(body.asset);
}

export async function updatePhotoMetadata(
  assetId: string,
  sourceText: UpdateSourceTextInput,
): Promise<PhotoAssetResponse> {
  return parseAssetResponse(await fetch(`/api/assets/${assetId}/metadata`, {
    body: JSON.stringify(sourceText),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  }));
}

export async function rerunPhotoRecognition(assetId: string) {
  const response = await fetch(`/api/assets/${assetId}/recognition`, { method: "POST" });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

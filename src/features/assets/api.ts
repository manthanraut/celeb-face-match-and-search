import {
  assetDetailSchema,
  assetMetadataUpdateSchema,
  assetUploadResponseSchema,
  type AssetDetail,
  type AssetMetadataUpdate,
  type AssetUploadResult,
} from "./contracts";
import {
  assetEventMetadataResponseSchema,
  galleryContextResponseSchema,
  type AssetEventMetadataResponse,
  type GalleryEventContext,
} from "../../../shared/galleries";
import {
  photoSaveRequestSchema,
  photoSaveResponseSchema,
} from "../../../shared/photoSave";

export interface UploadPhotoAssetInput {
  clientAssetId: string;
  file: File;
  recognitionRequested: boolean;
}

interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

async function readError(response: Response) {
  try {
    const body = await response.json() as ApiErrorEnvelope;
    return body.error?.message ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

async function parseAssetDetail(response: Response): Promise<AssetDetail> {
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return assetDetailSchema.parse(await response.json());
}

export async function getPhotoAsset(assetId: string): Promise<AssetDetail> {
  return parseAssetDetail(await fetch(`/api/assets/${assetId}`));
}

export async function getPhotoEventMetadata(
  assetId: string,
): Promise<AssetEventMetadataResponse> {
  const response = await fetch(`/api/galleries/assets/${assetId}/event-metadata`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return assetEventMetadataResponseSchema.parse(await response.json());
}

export async function addPhotoToContent(
  assetId: string,
  eventName: string,
  year: number,
): Promise<AssetEventMetadataResponse> {
  const response = await fetch(`/api/galleries/copilot-photo-${assetId}/context`, {
    body: JSON.stringify({
      assetIds: [assetId],
      published: true,
      tags: [`${eventName} ${year}`],
    }),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const result = galleryContextResponseSchema.parse(await response.json());
  return assetEventMetadataResponseSchema.parse({ event: result.event });
}

export async function savePhotoChanges(
  assetId: string,
  sourceText: AssetMetadataUpdate,
  eventMetadata: GalleryEventContext | null,
) {
  const update = photoSaveRequestSchema.parse({
    ...(eventMetadata ? { eventMetadata } : {}),
    metadata: sourceText,
  });
  const response = await fetch(`/api/assets/${assetId}/editorial`, {
    body: JSON.stringify(update),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return photoSaveResponseSchema.parse(await response.json());
}

export async function uploadPhotoAssets(
  inputs: readonly UploadPhotoAssetInput[],
): Promise<AssetUploadResult[]> {
  const formData = new FormData();
  const manifest = inputs.map(({ clientAssetId, file, recognitionRequested }) => {
    formData.append("images", file, file.name);
    return { clientAssetId, recognitionRequested };
  });

  formData.append("manifest", JSON.stringify(manifest));

  const response = await fetch("/api/assets", {
    body: formData,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return assetUploadResponseSchema.parse(await response.json()).assets;
}

export async function updatePhotoMetadata(
  assetId: string,
  sourceText: AssetMetadataUpdate,
): Promise<AssetDetail> {
  const metadata = assetMetadataUpdateSchema.parse(sourceText);

  return parseAssetDetail(await fetch(`/api/assets/${assetId}/metadata`, {
    body: JSON.stringify(metadata),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  }));
}

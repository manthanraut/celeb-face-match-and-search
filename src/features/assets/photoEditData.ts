import type { AssetDetail } from "./contracts";

export interface PhotoEditData {
  assetId: string;
  height: number;
  lastModified: number;
  name: string;
  previewUrl: string | null;
  size: number;
  type: string;
  width: number;
}

export interface PhotoCrop {
  height: number;
  label: string;
  ratio: number;
  width: number;
}

export interface PhotoDimensions {
  height: number;
  width: number;
}

const CROP_RATIOS = [
  { label: "2:1", ratio: 2 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "16:10", ratio: 16 / 10 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "1:1", ratio: 1 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "2:3", ratio: 2 / 3 },
] as const;

export function createPhotoEditData(
  asset: AssetDetail,
  dimensions: PhotoDimensions,
): PhotoEditData {
  return {
    assetId: asset.assetId,
    height: dimensions.height,
    lastModified: Date.parse(asset.updatedAt),
    name: asset.originalFilename,
    previewUrl: asset.links.image,
    size: asset.sizeBytes,
    type: asset.mimeType,
    width: dimensions.width,
  };
}

export function createPhotoCrops(width: number, height: number): PhotoCrop[] {
  const originalRatio = width / height;

  return CROP_RATIOS.map(({ label, ratio }) => {
    if (originalRatio > ratio) {
      return { height, label, ratio, width: Math.round(height * ratio) };
    }

    return { height: Math.round(width / ratio), label, ratio, width };
  });
}

export function formatLastModified(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(timestamp);
}

export function formatFileType(type: string) {
  const subtype = type.split("/")[1];
  return subtype ? subtype.toUpperCase() : type.toUpperCase();
}

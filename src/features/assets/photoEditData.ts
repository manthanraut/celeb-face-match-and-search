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

const FALLBACK_LAST_MODIFIED = Date.parse("2026-08-18T12:15:00+05:30");

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

function readPositiveNumber(searchParams: URLSearchParams, key: string, fallback: number) {
  const value = Number(searchParams.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function readPhotoEditData(searchParams: URLSearchParams, assetId: string): PhotoEditData {
  return {
    assetId,
    height: readPositiveNumber(searchParams, "height", 900),
    lastModified: readPositiveNumber(searchParams, "lastModified", FALLBACK_LAST_MODIFIED),
    name: searchParams.get("name")?.trim() || "Untitled photo",
    previewUrl: searchParams.get("previewUrl"),
    size: readPositiveNumber(searchParams, "size", 0),
    type: searchParams.get("type")?.trim() || "image/jpeg",
    width: readPositiveNumber(searchParams, "width", 1600),
  };
}

export function createPhotoEditData(asset: PhotoAsset): PhotoEditData {
  return {
    assetId: asset.id,
    height: asset.image.height,
    lastModified: Date.parse(asset.updatedAt),
    name: asset.image.originalFileName,
    previewUrl: asset.image.url,
    size: asset.image.size,
    type: asset.image.mimeType,
    width: asset.image.width,
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
import type { PhotoAsset } from "../../../shared/contracts/assets";

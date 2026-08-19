export interface SelectedPhoto {
  file: File;
  height: number;
  id: string;
  name: string;
  previewUrl: string;
  size: number;
  type: string;
  width: number;
}

export function readImageDimensions(previewUrl: string) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new Image();

    image.addEventListener(
      "load",
      () => {
        resolve({ height: image.naturalHeight, width: image.naturalWidth });
      },
      { once: true },
    );

    image.addEventListener(
      "error",
      () => {
        reject(new Error("The image could not be displayed."));
      },
      { once: true },
    );

    image.src = previewUrl;
  });
}

export function createFileSignature(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function createClientAssetId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hexadecimal = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hexadecimal.slice(0, 8)}-${hexadecimal.slice(8, 12)}-${hexadecimal.slice(12, 16)}-${hexadecimal.slice(16, 20)}-${hexadecimal.slice(20)}`;
}

export async function createSelectedPhoto(file: File): Promise<SelectedPhoto> {
  const previewUrl = URL.createObjectURL(file);

  try {
    const dimensions = await readImageDimensions(previewUrl);

    return {
      file,
      height: dimensions.height,
      id: createClientAssetId(),
      name: file.name,
      previewUrl,
      size: file.size,
      type: file.type,
      width: dimensions.width,
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

export function createPhotoEditUrl(photo: SelectedPhoto) {
  return `/admin/photos/${photo.id}`;
}

export function formatFileSize(bytes: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "unit",
    unit: bytes >= 1_000_000 ? "megabyte" : "kilobyte",
    unitDisplay: "short",
  }).format(bytes >= 1_000_000 ? bytes / 1_000_000 : bytes / 1_000);
}

export function formatImageDimension(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

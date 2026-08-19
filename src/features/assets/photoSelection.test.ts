import { describe, expect, it } from "vitest";

import {
  createFileSignature,
  createPhotoEditUrl,
  formatFileSize,
  formatImageDimension,
  type SelectedPhoto,
} from "./photoSelection";

describe("photo selection utilities", () => {
  it("creates a stable signature from local file metadata", () => {
    const file = {
      lastModified: 1_754_000_000,
      name: "met-gala-look.jpg",
      size: 2_500_000,
    } as File;

    expect(createFileSignature(file)).toBe("met-gala-look.jpg:2500000:1754000000");
  });

  it("formats image dimensions and file sizes for display", () => {
    expect(formatImageDimension(3840)).toBe("3,840");
    expect(formatFileSize(2_500_000)).toBe("2.5 MB");
  });

  it("builds an edit URL using the persisted asset identifier", () => {
    const file = new File(["photo"], "red carpet.jpg", {
      lastModified: 1_787_032_800_000,
      type: "image/jpeg",
    });
    const photo: SelectedPhoto = {
      file,
      height: 2160,
      id: "photo-123",
      name: file.name,
      previewUrl: "blob:http://localhost/photo-123",
      size: file.size,
      type: file.type,
      width: 3840,
    };

    expect(createPhotoEditUrl(photo)).toBe("/admin/photos/photo-123");
  });
});

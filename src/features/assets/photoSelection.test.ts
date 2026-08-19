import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createClientAssetId,
  createFileSignature,
  createPhotoEditUrl,
  formatFileSize,
  formatImageDimension,
  type SelectedPhoto,
} from "./photoSelection";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("photo selection utilities", () => {
  it("creates a stable signature from local file metadata", () => {
    const file = {
      lastModified: 1_754_000_000,
      name: "met-gala-look.jpg",
      size: 2_500_000,
    } as File;

    expect(createFileSignature(file)).toBe("met-gala-look.jpg:2500000:1754000000");
  });

  it("uses the browser UUID implementation when it is available", () => {
    const randomUUID = vi.fn(() => "f167c99c-9ad0-4f3d-aad4-bf19cbe15a90");
    vi.stubGlobal("crypto", { randomUUID });

    expect(createClientAssetId()).toBe("f167c99c-9ad0-4f3d-aad4-bf19cbe15a90");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("creates a valid UUID when randomUUID is unavailable on an HTTP LAN origin", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(createClientAssetId()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(getRandomValues).toHaveBeenCalledOnce();
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

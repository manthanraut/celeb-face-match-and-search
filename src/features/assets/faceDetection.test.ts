import { describe, expect, it, vi } from "vitest";

import { FaceDetectionError, imageContainsFace } from "./faceDetection";

function createBitmapFixture() {
  return {
    bitmap: { close: vi.fn() } as unknown as ImageBitmap,
    createBitmap: vi.fn(),
  };
}

describe("local face detection", () => {
  it("accepts an image when the detector finds a face", async () => {
    const { bitmap, createBitmap } = createBitmapFixture();
    createBitmap.mockResolvedValue(bitmap);
    const detect = vi.fn(() => ({ detections: [{ boundingBox: {} }] }));

    await expect(imageContainsFace(new Blob(["face"]), {
      createBitmap,
      getDetector: async () => ({ detect }),
    })).resolves.toBe(true);

    expect(detect).toHaveBeenCalledWith(bitmap);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("rejects an image when the detector finds no faces", async () => {
    const { bitmap, createBitmap } = createBitmapFixture();
    createBitmap.mockResolvedValue(bitmap);

    await expect(imageContainsFace(new Blob(["landscape"]), {
      createBitmap,
      getDetector: async () => ({ detect: () => ({ detections: [] }) }),
    })).resolves.toBe(false);

    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("fails closed and releases the decoded image when detection fails", async () => {
    const { bitmap, createBitmap } = createBitmapFixture();
    createBitmap.mockResolvedValue(bitmap);

    await expect(imageContainsFace(new Blob(["image"]), {
      createBitmap,
      getDetector: async () => ({
        detect: () => {
          throw new Error("detector unavailable");
        },
      }),
    })).rejects.toBeInstanceOf(FaceDetectionError);

    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});

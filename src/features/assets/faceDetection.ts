const MEDIAPIPE_WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FACE_DETECTOR_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite";

interface FaceDetectionResultLike {
  detections: readonly unknown[];
}

interface FaceDetectorLike {
  detect(image: ImageBitmap): FaceDetectionResultLike;
}

export interface FaceDetectionDependencies {
  createBitmap?: (image: Blob) => Promise<ImageBitmap>;
  getDetector?: () => Promise<FaceDetectorLike>;
}

export class FaceDetectionError extends Error {
  constructor(options?: ErrorOptions) {
    super("The local face check could not be completed.", options);
    this.name = "FaceDetectionError";
  }
}

let detectorPromise: Promise<FaceDetectorLike> | null = null;

async function createDetector(): Promise<FaceDetectorLike> {
  const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT);

  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: FACE_DETECTOR_MODEL_URL,
    },
    minDetectionConfidence: 0.5,
    runningMode: "IMAGE",
  });
}

function getDetector(): Promise<FaceDetectorLike> {
  if (detectorPromise === null) {
    detectorPromise = createDetector().catch((error: unknown) => {
      detectorPromise = null;
      throw error;
    });
  }

  return detectorPromise;
}

export async function imageContainsFace(
  image: Blob,
  dependencies: FaceDetectionDependencies = {},
): Promise<boolean> {
  let bitmap: ImageBitmap | null = null;

  try {
    const createBitmap = dependencies.createBitmap ?? globalThis.createImageBitmap;
    if (typeof createBitmap !== "function") {
      throw new Error("This browser does not support local image decoding.");
    }

    const detector = await (dependencies.getDetector ?? getDetector)();
    bitmap = await createBitmap(image);
    return detector.detect(bitmap).detections.length > 0;
  } catch (error) {
    if (error instanceof FaceDetectionError) {
      throw error;
    }

    throw new FaceDetectionError({ cause: error });
  } finally {
    bitmap?.close();
  }
}

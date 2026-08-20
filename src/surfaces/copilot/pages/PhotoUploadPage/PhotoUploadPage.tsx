import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import {
  createFileSignature,
  createSelectedPhoto,
  type SelectedPhoto,
} from "../../../../features/assets/photoSelection";
import { uploadPhotoAssets } from "../../../../features/assets/api";
import {
  FaceDetectionError,
  imageContainsFace,
} from "../../../../features/assets/faceDetection";
import {
  MAX_ASSET_IMAGE_DIMENSION,
  MAX_ASSET_IMAGE_PIXELS,
  MAX_ASSET_UPLOAD_FILES,
  MAX_ASSET_UPLOAD_FILE_SIZE_BYTES,
} from "../../../../../shared/assets";

import { SelectedPhotoCard } from "./SelectedPhotoCard";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

function UploadIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 32 32" width="24">
      <path d="M16 23V5m0 0-7 7m7-7 7 7M5 27h22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
    </svg>
  );
}

export function PhotoUploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const selectedSignaturesRef = useRef(new Set<string>());

  const prepareFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const acceptedFiles: File[] = [];
    let duplicateCount = 0;
    let faceCheckErrorCount = 0;
    let invalidCount = 0;
    let limitCount = 0;
    let noFaceCount = 0;

    files.forEach((file) => {
      const signature = createFileSignature(file);

      if (!ACCEPTED_IMAGE_TYPES.has(file.type) || file.size > MAX_ASSET_UPLOAD_FILE_SIZE_BYTES) {
        invalidCount += 1;
        return;
      }

      if (selectedSignaturesRef.current.has(signature)) {
        duplicateCount += 1;
        return;
      }

      if (acceptedFiles.length >= MAX_ASSET_UPLOAD_FILES) {
        limitCount += 1;
        return;
      }

      selectedSignaturesRef.current.add(signature);
      acceptedFiles.push(file);
    });

    if (acceptedFiles.length === 0) {
      if (invalidCount > 0) {
        setMessage("Select valid JPG or PNG images up to 5 MB each.");
      } else if (duplicateCount > 0) {
        setMessage("Those images are already selected.");
      } else if (limitCount > 0) {
        setMessage("Upload no more than 10 images at a time.");
      }
      return;
    }

    setIsPreparing(true);
    setMessage("Checking images for faces before upload…");

    const preparedPhotos = await Promise.all(
      acceptedFiles.map(async (file) => {
        let selectedPhoto: SelectedPhoto | null = null;

        try {
          selectedPhoto = await createSelectedPhoto(file);

          if (
            selectedPhoto.width > MAX_ASSET_IMAGE_DIMENSION
            || selectedPhoto.height > MAX_ASSET_IMAGE_DIMENSION
            || selectedPhoto.width * selectedPhoto.height > MAX_ASSET_IMAGE_PIXELS
          ) {
            URL.revokeObjectURL(selectedPhoto.previewUrl);
            selectedSignaturesRef.current.delete(createFileSignature(file));
            invalidCount += 1;
            return null;
          }

          if (!await imageContainsFace(file)) {
            URL.revokeObjectURL(selectedPhoto.previewUrl);
            selectedSignaturesRef.current.delete(createFileSignature(file));
            noFaceCount += 1;
            return null;
          }

          return selectedPhoto;
        } catch (error) {
          if (selectedPhoto !== null) {
            URL.revokeObjectURL(selectedPhoto.previewUrl);
          }
          selectedSignaturesRef.current.delete(createFileSignature(file));
          if (error instanceof FaceDetectionError) {
            faceCheckErrorCount += 1;
          } else {
            invalidCount += 1;
          }
          return null;
        }
      }),
    );

    const validPhotos = preparedPhotos.filter((photo): photo is SelectedPhoto => photo !== null);

    if (validPhotos.length === 0) {
      setIsPreparing(false);
      if (faceCheckErrorCount > 0) {
        setMessage("Face detection could not be completed. No images were uploaded. Try again.");
      } else if (noFaceCount > 0) {
        setMessage(`${noFaceCount} ${noFaceCount === 1 ? "image was" : "images were"} skipped because no face was detected.`);
      } else {
        setMessage("The selected files did not meet the image upload requirements.");
      }
      return;
    }

    try {
      setMessage("Uploading images and queuing celebrity recognition…");
      const assets = await uploadPhotoAssets(validPhotos.map((photo) => ({
        clientAssetId: photo.id,
        file: photo.file,
      })));

      if (assets.length !== validPhotos.length) {
        throw new Error("The server returned an incomplete upload response.");
      }

      const uploadedPhotos = validPhotos.map((photo, index) => {
        const asset = assets[index];
        if (!asset) {
          throw new Error("The server returned an incomplete upload response.");
        }

        URL.revokeObjectURL(photo.previewUrl);
        return {
          ...photo,
          id: asset.assetId,
          name: asset.originalFilename,
          previewUrl: asset.links.image,
          size: asset.sizeBytes,
          type: asset.mimeType,
        };
      });

      setSelectedPhotos((currentPhotos) => [...currentPhotos, ...uploadedPhotos]);

      const messageParts = [`${uploadedPhotos.length} ${uploadedPhotos.length === 1 ? "image was" : "images were"} uploaded and queued for recognition.`];
      if (duplicateCount > 0) {
        messageParts.push(`${duplicateCount} duplicate ${duplicateCount === 1 ? "was" : "were"} skipped.`);
      }
      if (limitCount > 0) {
        messageParts.push(`${limitCount} ${limitCount === 1 ? "file was" : "files were"} skipped because each upload is limited to 10 images.`);
      }
      if (invalidCount > 0) {
        messageParts.push(`${invalidCount} invalid ${invalidCount === 1 ? "file was" : "files were"} skipped.`);
      }
      if (noFaceCount > 0) {
        messageParts.push(`${noFaceCount} ${noFaceCount === 1 ? "image was" : "images were"} skipped because no face was detected.`);
      }
      if (faceCheckErrorCount > 0) {
        messageParts.push(`${faceCheckErrorCount} ${faceCheckErrorCount === 1 ? "image could" : "images could"} not be checked and were not uploaded.`);
      }
      setMessage(messageParts.join(" "));
    } catch (error) {
      validPhotos.forEach((photo) => {
        URL.revokeObjectURL(photo.previewUrl);
        selectedSignaturesRef.current.delete(createFileSignature(photo.file));
      });
      setMessage(error instanceof Error ? error.message : "The images could not be uploaded.");
    } finally {
      setIsPreparing(false);
    }
  }, []);

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      void prepareFiles(event.target.files);
    }

    event.target.value = "";
  };

  const handleRemovePhoto = useCallback((photo: SelectedPhoto) => {
    setSelectedPhotos((currentPhotos) => currentPhotos.filter((currentPhoto) => currentPhoto.id !== photo.id));
    selectedSignaturesRef.current.delete(createFileSignature(photo.file));
    setMessage(`${photo.name} removed. You can select it again.`);
  }, []);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void prepareFiles(event.dataTransfer.files);
  };

  return (
    <div className="mx-auto w-full max-w-[60rem] px-6 pb-16 pt-6 sm:px-10 sm:pt-8">
        <h1 className="text-balance text-3xl font-bold tracking-[-0.025em]">
          Upload Photos
        </h1>

        <div
          className={`mt-6 grid min-h-32 place-items-center rounded-sm border bg-white px-5 py-7 shadow-[0_2px_5px_rgb(0_0_0/0.2)] transition-colors motion-reduce:transition-none sm:min-h-40 ${
            isDragging ? "border-[#2948b8] bg-[#f5f7ff]" : "border-neutral-300"
          }`}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <p className="text-lg font-bold">Drag files here</p>
            <input
              accept="image/jpeg,image/png"
              className="peer sr-only"
              disabled={isPreparing}
              id="photo-file-input"
              multiple
              name="photos"
              onChange={handleFileSelection}
              type="file"
            />
            <label
              className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border border-neutral-300 px-4 py-2 text-base font-bold text-[#2948b8] hover:bg-[#f5f7ff] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#2948b8]"
              htmlFor="photo-file-input"
            >
              <UploadIcon />
              {isPreparing ? "Preparing…" : "Upload"}
            </label>
            <p className="mt-3 text-xs text-neutral-500">JPG or PNG · Must contain a face · Up to 5 MB each · Up to 10 images per upload</p>
          </div>
        </div>

        <p aria-live="polite" className="min-h-6 pt-3 text-sm text-neutral-600" role="status">
          {message}
        </p>

        {selectedPhotos.length > 0 ? (
          <section aria-labelledby="selected-photos-title" className="mt-3">
            <h2 className="sr-only" id="selected-photos-title">
              Selected Photos
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedPhotos.map((photo) => (
                <SelectedPhotoCard key={photo.id} onRemove={handleRemovePhoto} photo={photo} />
              ))}
            </div>
          </section>
        ) : null}
    </div>
  );
}

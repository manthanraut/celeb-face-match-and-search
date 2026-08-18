import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import {
  createFileSignature,
  createSelectedPhoto,
  type SelectedPhoto,
} from "../../../../features/assets/photoSelection";
import { uploadPhotoAsset } from "../../../../features/assets/api";

import { SelectedPhotoCard } from "./SelectedPhotoCard";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const MAXIMUM_FILE_SIZE = 5 * 1024 * 1024;

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
  const objectUrlsRef = useRef(new Set<string>());
  const selectedSignaturesRef = useRef(new Set<string>());

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;

    return () => {
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, []);

  const prepareFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const acceptedFiles: File[] = [];
    let duplicateCount = 0;
    let invalidCount = 0;

    files.forEach((file) => {
      const signature = createFileSignature(file);

      if (!ACCEPTED_IMAGE_TYPES.has(file.type) || file.size > MAXIMUM_FILE_SIZE) {
        invalidCount += 1;
        return;
      }

      if (selectedSignaturesRef.current.has(signature)) {
        duplicateCount += 1;
        return;
      }

      selectedSignaturesRef.current.add(signature);
      acceptedFiles.push(file);
    });

    if (acceptedFiles.length === 0) {
      if (invalidCount > 0) {
        setMessage("Select JPG, PNG, or WebP image files.");
      } else if (duplicateCount > 0) {
        setMessage("Those images are already selected.");
      }
      return;
    }

    setIsPreparing(true);
    setMessage("Uploading images and queuing celebrity recognition…");

    const preparedPhotos = await Promise.all(
      acceptedFiles.map(async (file) => {
        let localPreviewUrl: string | null = null;

        try {
          const selectedPhoto = await createSelectedPhoto(file);
          localPreviewUrl = selectedPhoto.previewUrl;
          const asset = await uploadPhotoAsset({
            file,
            height: selectedPhoto.height,
            width: selectedPhoto.width,
          });

          URL.revokeObjectURL(selectedPhoto.previewUrl);
          localPreviewUrl = null;
          return {
            ...selectedPhoto,
            id: asset.id,
            previewUrl: asset.image.url,
          };
        } catch {
          if (localPreviewUrl) {
            URL.revokeObjectURL(localPreviewUrl);
          }
          selectedSignaturesRef.current.delete(createFileSignature(file));
          invalidCount += 1;
          return null;
        }
      }),
    );

    const validPhotos = preparedPhotos.filter((photo): photo is SelectedPhoto => photo !== null);
    setSelectedPhotos((currentPhotos) => [...currentPhotos, ...validPhotos]);
    setIsPreparing(false);

    const messageParts = [`${validPhotos.length} ${validPhotos.length === 1 ? "image was" : "images were"} uploaded and queued for recognition.`];
    if (duplicateCount > 0) {
      messageParts.push(`${duplicateCount} duplicate ${duplicateCount === 1 ? "was" : "were"} skipped.`);
    }
    if (invalidCount > 0) {
      messageParts.push(`${invalidCount} invalid ${invalidCount === 1 ? "file was" : "files were"} skipped or failed to upload.`);
    }
    setMessage(messageParts.join(" "));
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
            <p className="mt-3 text-xs text-neutral-500">JPG or PNG · Up to 5 MB each · Select one or multiple images</p>
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

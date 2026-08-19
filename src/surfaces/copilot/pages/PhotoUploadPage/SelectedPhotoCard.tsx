import { Link } from "react-router-dom";

import {
  createPhotoEditUrl,
  formatFileSize,
  formatImageDimension,
  type SelectedPhoto,
} from "../../../../features/assets/photoSelection";

interface SelectedPhotoCardProps {
  isUploading: boolean;
  onRemove: (photo: SelectedPhoto) => void;
  photo: SelectedPhoto;
}

function RemoveIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20">
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function SelectedPhotoCard({ isUploading, onRemove, photo }: SelectedPhotoCardProps) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-sm border border-neutral-300 bg-white shadow-[0_2px_5px_rgb(0_0_0/0.16)]">
      <div className="relative grid aspect-[16/9] place-items-center overflow-hidden bg-neutral-100">
        <img
          alt={`Preview of ${photo.name}`}
          className="h-full w-full object-cover"
          decoding="async"
          height={photo.height}
          loading="lazy"
          src={photo.previewUrl}
          width={photo.width}
        />
        {photo.assetId === null ? (
          <button
            aria-label={`Remove ${photo.name}`}
            className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-950 shadow-md hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2948b8] disabled:cursor-not-allowed disabled:text-neutral-400"
            disabled={isUploading}
            onClick={() => onRemove(photo)}
            type="button"
          >
            <RemoveIcon />
          </button>
        ) : null}
      </div>

      <div className="flex min-h-32 flex-1 flex-col p-4">
        <h2 className="break-words text-base font-medium leading-6">{photo.name}</h2>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-base">Photo</strong>
              <span className="rounded-md border border-neutral-300 px-2 py-1 text-xs tabular-nums">
                {formatImageDimension(photo.width)} × {formatImageDimension(photo.height)}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">{formatFileSize(photo.size)}</p>
          </div>

          {photo.assetId ? (
            <Link
              aria-label={`Edit ${photo.name} in a new tab`}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#2948b8] px-4 py-2 text-sm font-bold text-[#2948b8] hover:bg-[#eef1ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2948b8]"
              rel="noopener noreferrer"
              target="_blank"
              to={createPhotoEditUrl(photo)}
            >
              Edit Photo
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center px-4 py-2 text-sm font-bold text-neutral-500">
              {isUploading ? "Uploading…" : "Upload pending"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

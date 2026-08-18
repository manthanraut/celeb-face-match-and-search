import { useState } from "react";

import {
  formatFileSize,
  formatImageDimension,
} from "../../../../features/assets/photoSelection";
import {
  formatFileType,
  formatLastModified,
  type PhotoEditData,
} from "../../../../features/assets/photoEditData";

interface PhotoMetadataPanelProps {
  photo: PhotoEditData;
}

const metadataRows = [
  ["Country", "—"],
  ["State", "—"],
  ["City", "—"],
  ["Copyright", "—"],
  ["Art Number", "—"],
  ["Rights Usage", "—"],
] as const;

export function PhotoMetadataPanel({ photo }: PhotoMetadataPanelProps) {
  const [showAllMetadata, setShowAllMetadata] = useState(true);

  return (
    <aside className="min-w-0">
      <div className="overflow-hidden rounded-md border border-neutral-300 bg-white">
        <div className="grid min-h-52 place-items-center overflow-hidden bg-neutral-100">
          {photo.previewUrl ? (
            <img
              alt={`Preview of ${photo.name}`}
              className="max-h-[28rem] w-full object-contain"
              decoding="async"
              height={photo.height}
              src={photo.previewUrl}
              width={photo.width}
            />
          ) : (
            <p className="px-6 text-center text-sm text-neutral-500">Photo preview unavailable</p>
          )}
        </div>

        <dl className="grid grid-cols-[minmax(6rem,0.9fr)_minmax(0,1.1fr)] gap-x-5 gap-y-4 px-5 py-6 text-sm sm:px-6">
          <dt className="font-bold">File Name</dt>
          <dd className="min-w-0 break-words">{photo.name}</dd>

          <dt className="font-bold">Dimensions</dt>
          <dd className="tabular-nums">
            {formatImageDimension(photo.width)} × {formatImageDimension(photo.height)} px
          </dd>

          <dt className="font-bold">File Size</dt>
          <dd>{photo.size > 0 ? formatFileSize(photo.size) : "—"}</dd>

          <dt className="font-bold">File Type</dt>
          <dd>{formatFileType(photo.type)}</dd>

          <dt className="font-bold">Date Created</dt>
          <dd>{formatLastModified(photo.lastModified)}</dd>

          {showAllMetadata
            ? metadataRows.map(([label, value]) => (
                <div className="contents" key={label}>
                  <dt className="font-bold">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))
            : null}
        </dl>

        <button
          className="mx-auto mb-4 block min-h-11 px-3 text-sm font-bold text-[#263ca8] underline decoration-2 underline-offset-2 hover:text-[#17266f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2948b8]"
          onClick={() => setShowAllMetadata((currentValue) => !currentValue)}
          type="button"
        >
          {showAllMetadata ? "Show Less" : "Show More"}
        </button>
      </div>

      {photo.previewUrl ? (
        <a
          className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-[#2948b8] hover:text-[#17266f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2948b8]"
          href={photo.previewUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          View Original
        </a>
      ) : null}
    </aside>
  );
}

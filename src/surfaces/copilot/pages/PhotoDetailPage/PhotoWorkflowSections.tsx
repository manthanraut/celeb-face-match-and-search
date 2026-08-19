import { useMemo, useState } from "react";

import { createPhotoCrops, type PhotoEditData } from "../../../../features/assets/photoEditData";
import { formatImageDimension } from "../../../../features/assets/photoSelection";

interface PhotoWorkflowSectionsProps {
  photo: PhotoEditData;
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <circle cx="10.5" cy="10.5" r="6.25" stroke="currentColor" strokeWidth="2.4" />
      <path d="m15.25 15.25 4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

function SearchField({ id, label, placeholder }: { id: string; label: string; placeholder: string }) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-md border border-neutral-300 bg-white px-4 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[#7c3cff]">
      <SearchIcon />
      <input
        aria-label={label}
        autoComplete="off"
        className="min-w-0 flex-1 py-2 text-base focus-visible:outline-none"
        id={id}
        name={id}
        placeholder={placeholder}
        type="search"
      />
    </div>
  );
}

export function PhotoWorkflowSections({ photo }: PhotoWorkflowSectionsProps) {
  const [doNotCrop, setDoNotCrop] = useState(false);
  const crops = useMemo(() => createPhotoCrops(photo.width, photo.height), [photo.height, photo.width]);

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-md border border-neutral-200 bg-white p-5 shadow-[0_2px_5px_rgb(0_0_0/0.16)]">
        <h2 className="text-xl font-bold">Taxonomy</h2>
        <div className="mt-5">
          <label className="mb-2 block text-base font-bold" htmlFor="taxonomy-tags">
            Tags
          </label>
          <SearchField id="taxonomy-tags" label="Search taxonomy tags" placeholder="Type to search…" />
        </div>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-5 shadow-[0_2px_5px_rgb(0_0_0/0.16)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Crops</h2>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
            <span>Do Not Crop</span>
            <input
              checked={doNotCrop}
              className="peer sr-only"
              onChange={(event) => setDoNotCrop(event.target.checked)}
              role="switch"
              type="checkbox"
            />
            <span className="relative h-7 w-12 rounded-full bg-neutral-400 transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#2948b8] peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#2948b8] motion-reduce:transition-none motion-reduce:after:transition-none" />
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {crops.map((crop) => (
            <article className="overflow-hidden rounded-md border border-neutral-300 bg-white" key={crop.label}>
              <div
                className="grid place-items-center overflow-hidden bg-neutral-100"
                style={{ aspectRatio: String(crop.ratio) }}
              >
                {photo.previewUrl ? (
                  <img
                    alt={`${crop.label} crop preview of ${photo.name}`}
                    className={`h-full w-full ${doNotCrop ? "object-contain" : "object-cover"}`}
                    decoding="async"
                    height={crop.height}
                    loading="lazy"
                    src={photo.previewUrl}
                    width={crop.width}
                  />
                ) : (
                  <span className="px-3 text-center text-sm text-neutral-500">Preview unavailable</span>
                )}
              </div>
              <div className="p-2.5 text-center">
                <h3 className="text-base font-bold">{crop.label}</h3>
                <p className="mt-1 tabular-nums text-xs">
                  ({formatImageDimension(crop.width)} × {formatImageDimension(crop.height)})
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-5 shadow-[0_2px_5px_rgb(0_0_0/0.16)]">
        <h2 className="text-xl font-bold">Collaborators</h2>
        <p className="mt-2 text-sm text-neutral-700">
          This list automatically includes everyone who has opened and saved this photo. These names will not be published in the byline.
        </p>
        <div className="mt-4 flex min-h-11 items-center gap-2.5 rounded-md border border-neutral-300 bg-white px-4 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[#7c3cff]">
          <SearchIcon />
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white">
            Manthan Raut <span aria-hidden="true">×</span>
          </span>
          <input
            aria-label="Search collaborators"
            autoComplete="off"
            className="min-w-0 flex-1 py-2 text-base focus-visible:outline-none"
            name="collaborators"
            placeholder="Type to search…"
            type="search"
          />
        </div>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";

import {
  MAX_ASSET_BACKSTORY_LENGTH,
  type AssetDetail,
} from "../../../../../shared/assets";

interface PhotoDetailsFormProps {
  asset: AssetDetail;
}

interface EditableMetadata {
  altText: string;
  backstory: string;
  caption: string;
  title: string;
}

const fieldStyles =
  "min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base focus-visible:border-[#7c3cff] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7c3cff]";

function MagicIcon() {
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-md bg-[#8338f5] text-base text-white"
    >
      ✣
    </span>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <circle cx="10.5" cy="10.5" r="6.25" stroke="currentColor" strokeWidth="2.4" />
      <path d="m15.25 15.25 4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

function FormattingControls() {
  return (
    <div aria-hidden="true" className="flex gap-3 text-base">
      <span className="grid size-9 place-items-center rounded-md bg-neutral-200 font-bold">≡</span>
      <span className="grid size-9 place-items-center font-mono text-sm font-bold">{"</>"}</span>
    </div>
  );
}

function toEditableMetadata(asset: AssetDetail): EditableMetadata {
  return {
    altText: asset.sourceText.altText ?? "",
    backstory: asset.sourceText.backstory ?? "",
    caption: asset.sourceText.caption ?? "",
    title: asset.sourceText.title ?? "",
  };
}

export function PhotoDetailsForm({ asset }: PhotoDetailsFormProps) {
  const [metadata, setMetadata] = useState<EditableMetadata>(() => toEditableMetadata(asset));
  const altTextWordCount = metadata.altText.trim()
    ? metadata.altText.trim().split(/\s+/).length
    : 0;
  const backstoryCharacterCount = metadata.backstory.length;

  useEffect(() => {
    setMetadata(toEditableMetadata(asset));
  }, [asset.assetId]);

  const updateField = (field: keyof EditableMetadata, value: string) => {
    setMetadata((current) => ({ ...current, [field]: value }));
  };

  return (
    <form className="min-w-0" onSubmit={(event) => event.preventDefault()}>
      <div>
        <label className="mb-1.5 block text-base font-bold" htmlFor="photo-title">
          Title
        </label>
        <div className="relative">
          <input
            autoComplete="off"
            className={`${fieldStyles} pr-12`}
            id="photo-title"
            maxLength={500}
            name="title"
            onChange={(event) => updateField("title", event.target.value)}
            type="text"
            value={metadata.title}
          />
          <MagicIcon />
        </div>
      </div>

      <div className="mt-2.5">
        <label className="mb-1.5 block text-base font-bold" htmlFor="photo-alt-text">
          Alt Text
        </label>
        <div className="relative">
          <input
            autoComplete="off"
            className={`${fieldStyles} pr-12`}
            id="photo-alt-text"
            maxLength={2_000}
            name="altText"
            onChange={(event) => updateField("altText", event.target.value)}
            type="text"
            value={metadata.altText}
          />
          <MagicIcon />
        </div>
        <div className="flex flex-wrap justify-between gap-2 pt-1 text-sm">
          <p className="text-[#6233cc]">
            {metadata.altText
              ? "Alt text is available for editorial review"
              : "Add descriptive alt text"}
          </p>
          <p className="tabular-nums text-neutral-600">
            {altTextWordCount} {altTextWordCount === 1 ? "word" : "words"}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-base font-bold" htmlFor="global-caption">
            Global Caption
          </label>
          <FormattingControls />
        </div>
        <textarea
          autoComplete="off"
          className={`${fieldStyles} min-h-16 resize-y`}
          id="global-caption"
          maxLength={5_000}
          name="caption"
          onChange={(event) => updateField("caption", event.target.value)}
          value={metadata.caption}
        />
      </div>

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-base font-bold">Byline</legend>
        <div className="flex min-h-11 rounded-md border border-neutral-300 bg-white focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[#7c3cff]">
          <select
            aria-label="Byline role"
            className="w-36 border-r border-neutral-300 bg-white px-3 text-base text-neutral-950 focus-visible:outline-none"
            defaultValue="Photographer"
            name="bylineRole"
          >
            <option>Photographer</option>
            <option>Illustrator</option>
            <option>Contributor</option>
          </select>
          <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3">
            <SearchIcon />
            <input
              aria-label="Byline contributor"
              autoComplete="off"
              className="min-w-0 flex-1 py-2 text-base focus-visible:outline-none"
              name="bylineContributor"
              placeholder="Type a name to begin…"
              type="search"
            />
          </div>
        </div>
      </fieldset>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-base font-bold" htmlFor="photo-credit">
            Credit
          </label>
          <FormattingControls />
        </div>
        <input autoComplete="off" className={fieldStyles} id="photo-credit" name="credit" type="text" />
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-base font-bold" htmlFor="internal-notes">
          Internal Notes
        </label>
        <textarea
          autoComplete="off"
          className={`${fieldStyles} min-h-16 resize-y`}
          id="internal-notes"
          name="internalNotes"
        />
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-base font-bold" htmlFor="photo-backstory">
          Backstory
        </label>
        <textarea
          aria-describedby="photo-backstory-count"
          autoComplete="off"
          className={`${fieldStyles} min-h-28 resize-y`}
          id="photo-backstory"
          maxLength={MAX_ASSET_BACKSTORY_LENGTH}
          name="backstory"
          onChange={(event) => updateField("backstory", event.target.value)}
          placeholder="Add editorial context or the story behind this image."
          value={metadata.backstory}
        />
        <p
          className="pt-1 text-right text-sm tabular-nums text-neutral-600"
          id="photo-backstory-count"
        >
          {backstoryCharacterCount}/{MAX_ASSET_BACKSTORY_LENGTH} characters
        </p>
      </div>

    </form>
  );
}

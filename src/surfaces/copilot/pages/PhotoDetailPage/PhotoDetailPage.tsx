import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { assetQueryKey, getAsset } from "../../../../features/assets/assetApi";
import { formatLastModified, readPhotoEditData } from "../../../../features/assets/photoEditData";

import { AiDiscoveryMetadataSection } from "./AiDiscoveryMetadataSection";
import { PhotoDetailsForm } from "./PhotoDetailsForm";
import { PhotoMetadataPanel } from "./PhotoMetadataPanel";
import { PhotoWorkflowSections } from "./PhotoWorkflowSections";

function LinkIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="m9.5 14.5 5-5m-7.2 8.9-1.7 1.7a3.5 3.5 0 0 1-5-5l3.2-3.2a3.5 3.5 0 0 1 5 0m6.4.2a3.5 3.5 0 0 1 0-5l3.2-3.2a3.5 3.5 0 1 1 5 5l-1.7 1.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.3"
      />
    </svg>
  );
}

export function PhotoDetailPage() {
  const { assetId = "photo" } = useParams();
  const [searchParams] = useSearchParams();
  const photo = useMemo(
    () => readPhotoEditData(searchParams, assetId),
    [assetId, searchParams],
  );
  const assetQuery = useQuery({
    queryFn: () => getAsset(assetId),
    queryKey: assetQueryKey(assetId),
  });
  const asset = assetQuery.data;
  const displayedPhoto = useMemo(
    () =>
      asset
        ? {
            ...photo,
            lastModified: Date.parse(asset.updatedAt),
            name: asset.originalFilename,
            previewUrl: asset.links.image,
            size: asset.sizeBytes,
            type: asset.mimeType,
          }
        : photo,
    [asset, photo],
  );

  if (assetQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-[82rem] px-6 py-16 text-center sm:px-10 lg:px-12">
        <p className="text-base text-neutral-600">Loading photo metadata…</p>
      </div>
    );
  }

  if (assetQuery.isError || !asset) {
    const message =
      assetQuery.error instanceof Error
        ? assetQuery.error.message
        : "The photo metadata could not be loaded.";

    return (
      <div className="mx-auto w-full max-w-[82rem] px-6 py-16 text-center sm:px-10 lg:px-12">
        <h1 className="text-2xl font-bold">Unable to load photo</h1>
        <p className="mt-3 text-base text-neutral-600">{message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[82rem] px-6 pb-16 pt-6 sm:px-10 sm:pt-8 lg:px-12">
        <header>
          <h1 className="text-balance text-3xl font-bold tracking-[-0.025em]">Photo</h1>
          <p className="mt-4 text-sm sm:text-base">
            Last modified on {formatLastModified(displayedPhoto.lastModified)} by Manthan Raut
          </p>
          <a
            className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-neutral-500 underline decoration-2 underline-offset-2 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2948b8]"
            href="#used-in"
          >
            <LinkIcon />
            Used in 0 places
          </a>
        </header>

        <section
          aria-label="Photo information"
          className="mt-6 rounded-md border border-neutral-200 bg-white p-4 shadow-[0_2px_5px_rgb(0_0_0/0.16)] sm:p-5"
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]">
            <PhotoMetadataPanel photo={displayedPhoto} />
            <PhotoDetailsForm asset={asset} />
          </div>
        </section>

        <AiDiscoveryMetadataSection assetId={asset.assetId} />

        <div className="scroll-mt-24" id="used-in">
          <PhotoWorkflowSections photo={displayedPhoto} />
        </div>
    </div>
  );
}

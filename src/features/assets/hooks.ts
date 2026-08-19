import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { GalleryEventContext } from "../../../shared/galleries";
import type { AssetDetail, AssetMetadataUpdate } from "./contracts";
import { addPhotoToContent, getPhotoAsset, getPhotoEventMetadata, updatePhotoMetadata } from "./api";
import { readImageDimensions } from "./photoSelection";

function assetQueryKey(assetId: string) {
  return ["photo-asset", assetId] as const;
}

function eventMetadataQueryKey(assetId: string) {
  return ["photo-event-metadata", assetId] as const;
}

function shouldPollForEnrichment(asset: AssetDetail | undefined) {
  if (!asset) return false;
  if (asset.recognition.status === "QUEUED" || asset.recognition.status === "PROCESSING") {
    return true;
  }

  return asset.recognition.status === "SUCCEEDED" && (
    asset.enrichment.recognitionRevision !== asset.recognition.revision
    || asset.enrichment.sourceTextRevision !== asset.sourceText.revision
  );
}

export function usePhotoAsset(assetId: string) {
  return useQuery({
    enabled: Boolean(assetId),
    queryFn: () => getPhotoAsset(assetId),
    queryKey: assetQueryKey(assetId),
    refetchInterval: (query) => {
      return shouldPollForEnrichment(query.state.data) ? 1_000 : false;
    },
  });
}

export function usePhotoImageDimensions(imageUrl: string | undefined) {
  return useQuery({
    enabled: Boolean(imageUrl),
    queryFn: () => readImageDimensions(imageUrl ?? ""),
    queryKey: ["photo-image-dimensions", imageUrl],
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function usePhotoEventMetadata(assetId: string) {
  return useQuery({
    enabled: Boolean(assetId),
    queryFn: () => getPhotoEventMetadata(assetId),
    queryKey: eventMetadataQueryKey(assetId),
  });
}

export function useSavePhoto(assetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventMetadata,
      sourceText,
    }: {
      eventMetadata: GalleryEventContext | null;
      sourceText: AssetMetadataUpdate;
    }) => {
      const [asset, savedEventMetadata] = await Promise.all([
        updatePhotoMetadata(assetId, sourceText),
        eventMetadata
          ? addPhotoToContent(assetId, eventMetadata.name, eventMetadata.year)
          : Promise.resolve(null),
      ]);

      return { asset, eventMetadata: savedEventMetadata };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(assetQueryKey(assetId), result.asset);
      if (result.eventMetadata) {
        queryClient.setQueryData(eventMetadataQueryKey(assetId), result.eventMetadata);
      }
    },
  });
}

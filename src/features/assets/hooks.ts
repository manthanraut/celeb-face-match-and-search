import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AssetDetail, AssetMetadataUpdate } from "./contracts";
import { addPhotoToContent, getPhotoAsset, getPhotoEventMetadata, updatePhotoMetadata } from "./api";
import { readImageDimensions } from "./photoSelection";

function assetQueryKey(assetId: string) {
  return ["photo-asset", assetId] as const;
}

function eventMetadataQueryKey(assetId: string) {
  return ["photo-event-metadata", assetId] as const;
}

const contentEventOptions = ["Met Gala", "Oscars", "Vogue World", "Golden Globe"] as const;
const contentEventYears = [2026, 2025, 2024, 2023] as const;

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

export function useAddPhotoToContent(assetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const eventName = contentEventOptions[Math.floor(Math.random() * contentEventOptions.length)];
      const year = contentEventYears[Math.floor(Math.random() * contentEventYears.length)];
      return addPhotoToContent(assetId, eventName, year);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(eventMetadataQueryKey(assetId), result);
    },
  });
}

export function useUpdatePhotoMetadata(assetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceText: AssetMetadataUpdate) => updatePhotoMetadata(assetId, sourceText),
    onSuccess: (result) => {
      queryClient.setQueryData(assetQueryKey(assetId), result);
    },
  });
}

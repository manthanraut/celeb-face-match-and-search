import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { UpdateSourceTextInput } from "../../../shared/contracts/assets";
import { getPhotoAsset, rerunPhotoRecognition, updatePhotoMetadata } from "./api";

function assetQueryKey(assetId: string) {
  return ["photo-asset", assetId] as const;
}

export function usePhotoAsset(assetId: string) {
  return useQuery({
    queryFn: () => getPhotoAsset(assetId),
    queryKey: assetQueryKey(assetId),
    refetchInterval: (query) => {
      const status = query.state.data?.asset.recognition.status;
      return status === "queued" || status === "processing" ? 1_000 : false;
    },
  });
}

export function useUpdatePhotoMetadata(assetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceText: UpdateSourceTextInput) => updatePhotoMetadata(assetId, sourceText),
    onSuccess: (result) => {
      queryClient.setQueryData(assetQueryKey(assetId), result);
    },
  });
}

export function useRerunPhotoRecognition(assetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => rerunPhotoRecognition(assetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assetQueryKey(assetId) }),
  });
}

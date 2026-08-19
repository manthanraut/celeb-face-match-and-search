import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PhotoSaveResponse } from "../../../shared/photoSave";

const reactQueryMocks = vi.hoisted(() => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => reactQueryMocks);

import { useSavePhoto } from "./hooks";

describe("asset hooks", () => {
  beforeEach(() => {
    reactQueryMocks.useMutation.mockReset();
    reactQueryMocks.useQueryClient.mockReset();
  });

  it("invalidates every Verso search query after an editorial save", async () => {
    const queryClient = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      setQueryData: vi.fn(),
    };
    reactQueryMocks.useQueryClient.mockReturnValue(queryClient);
    reactQueryMocks.useMutation.mockImplementation((options) => options);

    const mutation = useSavePhoto("64b000000000000000000001") as unknown as {
      onSuccess(result: PhotoSaveResponse): Promise<void>;
    };
    const result = {
      asset: { assetId: "64b000000000000000000001" },
      eventMetadata: { event: { id: "met-gala", name: "Met Gala", year: 2026 } },
    } as PhotoSaveResponse;

    await mutation.onSuccess(result);

    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      ["photo-asset", "64b000000000000000000001"],
      result.asset,
    );
    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      ["photo-event-metadata", "64b000000000000000000001"],
      result.eventMetadata,
    );
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["verso-search"],
    });
  });
});

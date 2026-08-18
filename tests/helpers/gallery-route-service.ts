import type { GalleryRouteService } from "../../server/routes/galleries.js";

export function createUnusedGalleryRouteService(): GalleryRouteService {
  const unexpectedCall = async (): Promise<never> => {
    throw new Error("The gallery service was not expected to be called by this test.");
  };

  return {
    removeAsset: unexpectedCall,
    syncContext: unexpectedCall,
  };
}

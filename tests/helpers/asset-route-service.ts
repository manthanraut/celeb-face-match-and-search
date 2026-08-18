import type { AssetRouteService } from "../../server/routes/assets.js";

export function createUnusedAssetRouteService(): AssetRouteService {
  const unexpectedCall = async (): Promise<never> => {
    throw new Error("The asset service was not expected to be called by this test.");
  };

  return {
    getById: unexpectedCall,
    ingest: unexpectedCall,
    list: unexpectedCall,
    openImage: unexpectedCall,
    retryRecognition: unexpectedCall,
  };
}

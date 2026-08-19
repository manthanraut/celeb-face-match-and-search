import type { VersoSearchRouteService } from "../../server/routes/search.js";

export function createUnusedVersoSearchRouteService(): VersoSearchRouteService {
  const unexpectedCall = async (): Promise<never> => {
    throw new Error("The Verso search service was not expected to be called by this test.");
  };

  return {
    getCelebrityArchive: unexpectedCall,
    search: unexpectedCall,
  };
}

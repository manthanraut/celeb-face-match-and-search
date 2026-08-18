export interface GalleryAssetRepository {
  findExistingAssetIds(assetIds: readonly string[]): Promise<Set<string>>;
}

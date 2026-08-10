import brandJson from "../../../brands/record/brand.json";
import { brandPackSchema } from "@/features/campaigns/schemas";

export const recordBrandPack = brandPackSchema.parse(brandJson);

export function recordPhotoAssetMap() {
  return Object.fromEntries(recordBrandPack.photoAssets.map((asset) => [asset.id, asset.path]));
}

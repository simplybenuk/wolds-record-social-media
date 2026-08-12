/* Record-pack convenience accessors.
   Kept as a thin façade over the generic pack loader so existing call sites and
   tests keep working while brand identity moves into src/lib/brand/packs.ts. */
import { RECORD_PACK_ID, photoAssetMapFor, requireBrandPack } from "./packs";

export const recordBrandPack = requireBrandPack(RECORD_PACK_ID);

export function recordPhotoAssetMap() {
  return photoAssetMapFor(recordBrandPack);
}

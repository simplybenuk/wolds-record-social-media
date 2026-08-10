import { isAbsolute, normalize } from "node:path";

export type LegacyVisualTemplate = "problem" | "feature" | "hook" | "cta";

export type DraftPostForRendering = {
  id: string;
  visualTemplate: LegacyVisualTemplate;
  headline: string;
  emphasis: string | null;
  body: string;
  footer: string;
  instagramCaption: string;
  hashtags: readonly string[];
  altText: string;
  photoAssetId: string | null;
};

export type LegacyRendererBrand = {
  brandId: string;
  logoPath: string;
  photoAssets: Readonly<Record<string, string>>;
};

export type LegacyStaticPost = {
  id: string;
  brand: string;
  format: "image";
  service: "instagram";
  instagramType: "post";
  aspectRatio: "square";
  template: LegacyVisualTemplate;
  kicker: "Wolds Record";
  headline: string;
  emphasis: string;
  body: string;
  footer: string;
  logoPath: string;
  photoPath: string;
  imageOpacity: 18;
  safeMode: "airy";
  caption: string;
  hashtags: string[];
  altText: string;
};

export class LegacyPostAdapterError extends Error {
  readonly code = "asset_missing";

  constructor(message: string){
    super(message);
    this.name = "LegacyPostAdapterError";
  }
}

function assertRepositoryAssetPath(path: string, label: string): string {
  const trimmed = path.trim();
  const normalized = normalize(trimmed);

  if(
    !trimmed ||
    isAbsolute(trimmed) ||
    trimmed.includes("\\") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ||
    normalized === ".." ||
    normalized.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ){
    throw new LegacyPostAdapterError(`${label} is not an allowed repository asset path.`);
  }

  return normalized;
}

export function adaptDraftPostToLegacyPost(
  draft: DraftPostForRendering,
  brand: LegacyRendererBrand
): LegacyStaticPost {
  const logoPath = assertRepositoryAssetPath(brand.logoPath, "Brand logo");
  let photoPath = "";

  if(draft.photoAssetId !== null){
    if(!Object.hasOwn(brand.photoAssets, draft.photoAssetId)){
      throw new LegacyPostAdapterError(
        `Photo asset "${draft.photoAssetId}" is not available for this brand.`
      );
    }

    photoPath = assertRepositoryAssetPath(
      brand.photoAssets[draft.photoAssetId],
      `Photo asset "${draft.photoAssetId}"`
    );
  }

  return {
    id: draft.id,
    brand: brand.brandId,
    format: "image",
    service: "instagram",
    instagramType: "post",
    aspectRatio: "square",
    template: draft.visualTemplate,
    kicker: "Wolds Record",
    headline: draft.headline,
    emphasis: draft.emphasis ?? "",
    body: draft.body,
    footer: draft.footer,
    logoPath,
    photoPath,
    imageOpacity: 18,
    safeMode: "airy",
    caption: draft.instagramCaption,
    hashtags: [...draft.hashtags],
    altText: draft.altText
  };
}

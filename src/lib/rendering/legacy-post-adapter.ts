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

export type LegacyPalette = {
  paper: string;
  ink: string;
  inkSoft: string;
  accent: string;
  deep: string;
};

export type LegacyFonts = {
  headlineFont: string;
  bodyFont: string;
};

export type LegacyRendererBrand = {
  brandId: string;
  logoPath: string;
  photoAssets: Readonly<Record<string, string>>;
  /** Display name used as the on-image kicker. */
  kicker: string;
  handle: string;
  palette: LegacyPalette;
  fonts: LegacyFonts;
  imageOpacity: number;
  safeMode: "airy";
  aspectRatio: "square";
};

export type LegacyStaticPost = {
  id: string;
  brand: string;
  format: "image";
  service: "instagram";
  instagramType: "post";
  aspectRatio: "square" | "portrait";
  template: LegacyVisualTemplate | "bold-hook" | "photo-led" | "useful-point" | "contrast" | "human-prompt" | "action";
  kicker: string;
  handle: string;
  palette: LegacyPalette;
  fonts: LegacyFonts;
  headline: string;
  emphasis: string;
  body: string;
  footer: string;
  logoPath: string;
  photoPath: string;
  imageOpacity: number;
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
    aspectRatio: brand.aspectRatio,
    template: draft.visualTemplate,
    kicker: brand.kicker,
    handle: brand.handle,
    palette: brand.palette,
    fonts: brand.fonts,
    headline: draft.headline,
    emphasis: draft.emphasis ?? "",
    body: draft.body,
    footer: draft.footer,
    logoPath,
    photoPath,
    imageOpacity: brand.imageOpacity,
    safeMode: brand.safeMode,
    caption: draft.instagramCaption,
    hashtags: [...draft.hashtags],
    altText: draft.altText
  };
}

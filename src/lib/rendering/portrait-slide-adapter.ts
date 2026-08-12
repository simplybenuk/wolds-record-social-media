import { isAbsolute, normalize } from "node:path";
import type { BrandPack, GeneratedSlide } from "@/features/campaigns/types";

export type PortraitStaticSlide = {
  id: string;
  brand: string;
  format: "image";
  service: "instagram";
  instagramType: "post";
  aspectRatio: "portrait";
  template: GeneratedSlide["visualTemplate"];
  kicker: string;
  handle: string;
  palette: BrandPack["visualStyle"]["palette"];
  fonts: { headlineFont: string; bodyFont: string };
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

function safePath(path: string) {
  const value = normalize(path.trim());
  if (!value || isAbsolute(value) || value.includes("\\") || value === ".." || value.startsWith("../")) throw new Error("asset_missing");
  return value;
}

export function adaptSlideToPortrait(
  post: { id: string; instagramCaption: string; hashtags: string[]; engagementCta: string },
  slide: GeneratedSlide,
  pack: BrandPack,
): PortraitStaticSlide {
  const asset = slide.photoAssetId ? pack.photoAssets.find((candidate) => candidate.id === slide.photoAssetId) : undefined;
  if (slide.photoAssetId && !asset) throw new Error("asset_missing");
  return {
    id: `${post.id}-${slide.ordinal}`,
    brand: pack.id, format: "image", service: "instagram", instagramType: "post",
    aspectRatio: "portrait", template: slide.visualTemplate,
    kicker: pack.displayName, handle: `@${pack.instagramHandle}`,
    palette: { ...pack.visualStyle.palette },
    fonts: { headlineFont: pack.visualStyle.headlineFont, bodyFont: pack.visualStyle.bodyFont },
    headline: slide.headline, emphasis: slide.emphasis ?? "", body: slide.body ?? "",
    footer: slide.footer ?? post.engagementCta,
    logoPath: safePath(pack.logo.path), photoPath: asset ? safePath(asset.path) : "",
    imageOpacity: slide.visualTemplate === "photo-led" ? 100 : slide.visualTemplate === "bold-hook" ? 0 : 72,
    safeMode: "airy", caption: post.instagramCaption, hashtags: [...post.hashtags], altText: slide.altText,
  };
}

import recordJson from "../../../brands/record/brand.json";
import massageJson from "../../../brands/massage/brand.json";
import academyJson from "../../../brands/academy/brand.json";
import { brandPackSchema } from "@/features/campaigns/schemas";
import { LEGACY_BRAND_ALIASES, type BrandPack } from "@/features/campaigns/types";

export const RECORD_PACK_ID = "record";

/* One loader, one schema, N packs. A pack missing a required field fails here,
   at load time, with the field named — never a silent default. */
const PACK_SOURCES: Readonly<Record<string, unknown>> = {
  [RECORD_PACK_ID]: recordJson,
  massage: massageJson,
  academy: academyJson,
};

function loadPack(id: string, source: unknown): BrandPack {
  const result = brandPackSchema.safeParse(source);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Brand pack "${id}" is invalid — ${detail}`);
  }

  if (result.data.id !== id) {
    throw new Error(
      `Brand pack "${id}" declares mismatched id "${result.data.id}".`,
    );
  }

  return result.data;
}

const PACKS: Readonly<Record<string, BrandPack>> = Object.freeze(
  Object.fromEntries(
    Object.entries(PACK_SOURCES).map(([id, source]) => [id, loadPack(id, source)]),
  ),
);

/** Packs that actually exist on disk — the brands the UI may offer. */
export function enabledBrandPacks(): BrandPack[] {
  return Object.values(PACKS);
}

export function brandPackById(id: string): BrandPack | undefined {
  // hasOwn guard: without it "toString" or "constructor" resolves to a function.
  return Object.hasOwn(PACKS, id) ? PACKS[id] : undefined;
}

/** Throwing lookup for call sites that require a known brand. */
export function requireBrandPack(id: string): BrandPack {
  const pack = brandPackById(id);

  if (!pack) {
    throw new Error(`Unknown brand pack "${id}".`);
  }

  return pack;
}

export type BrandResolution = {
  pack: BrandPack;
  /** Set when the supplied value was not a known pack ID or legacy alias. */
  warning: string | null;
};

/**
 * Resolve a pack from a persisted or legacy `brand` value.
 *
 * An unrecognised value is not a hard failure: it resolves to the Record pack
 * with a warning, so existing free-text records keep rendering.
 */
export function resolveBrand(value: string | null | undefined): BrandResolution {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    return { pack: requireBrandPack(RECORD_PACK_ID), warning: null };
  }

  const canonical = Object.hasOwn(LEGACY_BRAND_ALIASES, trimmed)
    ? LEGACY_BRAND_ALIASES[trimmed]
    : trimmed;
  const pack = brandPackById(canonical);

  if (pack) {
    return { pack, warning: null };
  }

  return {
    pack: requireBrandPack(RECORD_PACK_ID),
    warning: `Unrecognised brand "${trimmed}"; rendered with the Record palette.`,
  };
}

export function photoAssetMapFor(pack: BrandPack): Record<string, string> {
  return Object.fromEntries(pack.photoAssets.map((asset) => [asset.id, asset.path]));
}

/**
 * Build the renderer's brand input from a pack. This is the single place the
 * static renderer's visual identity is resolved, shared by the application
 * render service and the legacy CLI, so the two cannot drift.
 */
export function legacyRendererBrandFor(pack: BrandPack) {
  return {
    brandId: pack.id,
    logoPath: pack.logo.path,
    photoAssets: photoAssetMapFor(pack),
    kicker: pack.displayName,
    handle: `@${pack.instagramHandle}`,
    palette: { ...pack.visualStyle.palette },
    fonts: {
      headlineFont: pack.visualStyle.headlineFont,
      bodyFont: pack.visualStyle.bodyFont,
    },
    imageOpacity: pack.visualStyle.imageOpacity,
    safeMode: pack.visualStyle.safeMode,
    aspectRatio: pack.visualStyle.aspectRatio,
  } as const;
}

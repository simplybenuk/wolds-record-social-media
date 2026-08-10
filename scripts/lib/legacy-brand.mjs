import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const aliases = Object.freeze({
  "wolds-record": "record",
  "wolds-canine-massage": "massage",
  "wolds-canine-therapy-academy": "academy",
});

const packs = Object.freeze(Object.fromEntries(
  ["record", "massage", "academy"].map((id) => [
    id,
    JSON.parse(readFileSync(resolve("brands", id, "brand.json"), "utf8")),
  ]),
));

function canonicalBrand(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "record";
  return Object.hasOwn(aliases, trimmed) ? aliases[trimmed] : trimmed;
}

function identityFromPack(pack) {
  return {
    kicker: pack.displayName,
    handle: `@${pack.instagramHandle}`,
    palette: { ...pack.visualStyle.palette },
    fonts: {
      headlineFont: pack.visualStyle.headlineFont,
      bodyFont: pack.visualStyle.bodyFont,
    },
    logoPath: pack.logo.path,
    imageOpacity: pack.visualStyle.imageOpacity,
    safeMode: pack.visualStyle.safeMode,
    aspectRatio: pack.visualStyle.aspectRatio,
  };
}

/** Apply pack identity without changing the legacy CLI's JSON stdout contract. */
export function resolveLegacyBrandPost(post) {
  const canonical = canonicalBrand(post.brand);
  const pack = Object.hasOwn(packs, canonical) ? packs[canonical] : packs.record;
  const warning = pack.id === canonical
    ? null
    : `Unrecognised brand "${String(post.brand ?? "")}"; rendered with the Record identity.`;
  const identity = identityFromPack(pack);

  // Existing Record records keep explicit per-post values for byte-identical
  // legacy output. A non-Record post gets the selected pack's identity.
  return {
    post: canonical === "record" ? { ...identity, ...post } : { ...post, ...identity },
    warning,
  };
}

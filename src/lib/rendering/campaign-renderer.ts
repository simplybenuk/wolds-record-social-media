import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { AppDatabase } from "@/db";
import type { DraftPostRow, DraftPostSlideRow } from "@/db/schema";
import { setRenderFailed, setRenderReady, setRenderStarted } from "@/features/campaigns/repository";
import type { GeneratedSlide } from "@/features/campaigns/types";
import { enabledBrandPacks, resolveBrand } from "@/lib/brand/packs";
import { adaptSlideToPortrait } from "./portrait-slide-adapter";
import { StaticImageRenderError, StaticImageRenderer } from "./static-image-renderer";
import { assertCompletePortraitSet } from "./png-validation";

let applicationRenderQueue: Promise<void> = Promise.resolve();
function serializeApplicationRender<T>(operation: () => Promise<T>): Promise<T> {
  const result = applicationRenderQueue.then(operation, operation);
  applicationRenderQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function createCampaignRenderer() {
  return new StaticImageRenderer({ repositoryRoot: process.cwd(), mediaRoot: resolve(process.cwd(), "generated"), allowedAssetPaths: enabledBrandPacks().flatMap((pack) => [pack.logo.path, ...pack.photoAssets.map((asset) => asset.path)]), executablePath: process.env.PLAYWRIGHT_CHROME_PATH });
}

type RenderablePost = DraftPostRow & { slides: DraftPostSlideRow[] };
export async function renderPostPreview(database: AppDatabase, post: RenderablePost, renderer: Pick<StaticImageRenderer, "render"> = createCampaignRenderer()) {
  return serializeApplicationRender(async () => {
    const expected = setRenderStarted(database, post.id, post.version);
    const token = randomUUID().replaceAll("-", "");
    const temporaryRelative = `campaigns/${post.campaignId}/${post.id}/.tmp_${token}`;
    const temporaryAbsolute = resolve(process.cwd(), "generated", temporaryRelative);
    try {
      const pack = resolveBrand(post.brandId).pack;
      const hashtags = JSON.parse(post.hashtags) as string[];
      const relativePaths: string[] = [];
      for (const slideRow of post.slides) {
        const slide: GeneratedSlide = { ordinal: slideRow.ordinal, role: slideRow.role as GeneratedSlide["role"], visualTemplate: slideRow.visualTemplate as GeneratedSlide["visualTemplate"], headline: slideRow.headline, body: slideRow.body, emphasis: slideRow.emphasis, footer: slideRow.footer, photoAssetId: slideRow.photoAssetId, altText: slideRow.altText };
        const rendered = adaptSlideToPortrait({ id: post.id, instagramCaption: post.instagramCaption, hashtags, engagementCta: post.engagementCta }, slide, pack);
        const result = await renderer.render({ post: rendered, relativeOutputPath: `${temporaryRelative}/${slide.ordinal}.png` });
        relativePaths.push(result.relativePath);
      }
      assertCompletePortraitSet(resolve(process.cwd(), "generated"), relativePaths, post.slides.map((slide) => slide.ordinal));
      const setName = `set_${expected.postVersion}_${token}`;
      const finalRelativeRoot = `campaigns/${post.campaignId}/${post.id}/${setName}`;
      const finalAbsolute = resolve(process.cwd(), "generated", finalRelativeRoot);
      mkdirSync(resolve(finalAbsolute, ".."), { recursive: true });
      if (!existsSync(temporaryAbsolute)) throw new Error("render_set_missing");
      renameSync(temporaryAbsolute, finalAbsolute);
      relativePaths.splice(0, relativePaths.length, ...post.slides.map((slide) => `${finalRelativeRoot}/${slide.ordinal}.png`));
      assertCompletePortraitSet(resolve(process.cwd(), "generated"), relativePaths, post.slides.map((slide) => slide.ordinal));
      const ready = setRenderReady(database, post.id, expected, relativePaths);
      if (!ready && existsSync(finalAbsolute)) rmSync(finalAbsolute, { recursive: true, force: true });
      return { relativePaths };
    } catch (error) {
      rmSync(temporaryAbsolute, { recursive: true, force: true });
      const safe = error instanceof StaticImageRenderError ? error : new StaticImageRenderError("render_failed", "The complete preview set could not be produced; the last good set was kept.");
      setRenderFailed(database, post.id, expected, { code: safe.code, message: safe.message });
      throw safe;
    }
  });
}

import { resolve } from "node:path";

import type { AppDatabase } from "@/db";
import type { DraftPostRow } from "@/db/schema";
import { generatedPostSchema } from "@/features/campaigns/schemas";
import {
  setRenderFailed,
  setRenderReady,
  setRenderStarted,
} from "@/features/campaigns/repository";
import { enabledBrandPacks, legacyRendererBrandFor, resolveBrand } from "@/lib/brand/packs";
import { adaptDraftPostToLegacyPost } from "./legacy-post-adapter";
import { StaticImageRenderError, StaticImageRenderer } from "./static-image-renderer";

function hashtags(post: DraftPostRow) {
  return JSON.parse(post.hashtags) as string[];
}

let applicationRenderQueue: Promise<void> = Promise.resolve();

function serializeApplicationRender<T>(operation: () => Promise<T>): Promise<T> {
  const result = applicationRenderQueue.then(operation, operation);
  applicationRenderQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function createCampaignRenderer() {
  return new StaticImageRenderer({
    repositoryRoot: process.cwd(),
    mediaRoot: resolve(process.cwd(), "generated"),
    allowedAssetPaths: [
      // Every enabled pack's assets; the per-post brand decides which are used.
      ...enabledBrandPacks().flatMap((pack) => [
        pack.logo.path,
        ...pack.photoAssets.map((asset) => asset.path),
      ]),
    ],
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH,
  });
}

export async function renderPostPreview(
  database: AppDatabase,
  post: DraftPostRow,
  renderer: Pick<StaticImageRenderer, "render"> = createCampaignRenderer(),
) {
  return serializeApplicationRender(async () => {
    const renderVersion = setRenderStarted(database, post.id, post.version);
    try {
    const legacy = adaptDraftPostToLegacyPost(
      {
        id: post.id,
        visualTemplate: generatedPostSchema.shape.visualTemplate.parse(post.visualTemplate),
        headline: post.headline,
        emphasis: post.emphasis,
        body: post.body,
        footer: post.footer,
        instagramCaption: post.instagramCaption,
        hashtags: hashtags(post),
        altText: post.altText,
        photoAssetId: post.photoAssetId,
      },
      legacyRendererBrandFor(resolveBrand(post.brandId).pack),
    );
    const result = await renderer.render({
      post: legacy,
      relativeOutputPath: `campaigns/${post.campaignId}/${post.id}.png`,
    });
    setRenderReady(database, post.id, renderVersion, result.relativePath);
      return result;
    } catch (error) {
      const safe =
        error instanceof StaticImageRenderError
          ? error
          : new StaticImageRenderError("render_failed", "The preview could not be produced.");
      setRenderFailed(database, post.id, renderVersion, { code: safe.code, message: safe.message });
      throw safe;
    }
  });
}

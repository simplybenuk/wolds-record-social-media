import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  adaptDraftPostToLegacyPost,
  LegacyPostAdapterError,
  type DraftPostForRendering,
} from "../src/lib/rendering/legacy-post-adapter.ts";
import {
  StaticImageRenderer,
  StaticImageRenderError,
} from "../src/lib/rendering/static-image-renderer.ts";

const draft: DraftPostForRendering = {
  id: "post-1",
  visualTemplate: "problem",
  headline: "Scattered notes take time",
  emphasis: "Scattered",
  body: "Keep the useful context together.",
  footer: "Follow along as we build Wolds Record",
  instagramCaption: "A channel-specific caption.",
  hashtags: ["woldsrecord", "caninetherapy", "caninemassage"],
  altText: "A Wolds Record graphic about scattered notes.",
  photoAssetId: "dog-one",
};

const brand = {
  brandId: "record",
  logoPath: "assets/logo.png",
  photoAssets: { "dog-one": "assets/dog.png" },
};

test("the draft adapter owns legacy defaults without publication fields", () => {
  const post = adaptDraftPostToLegacyPost(draft, brand);

  assert.deepEqual(post, {
    id: "post-1",
    brand: "record",
    format: "image",
    service: "instagram",
    instagramType: "post",
    aspectRatio: "square",
    template: "problem",
    kicker: "Wolds Record",
    headline: "Scattered notes take time",
    emphasis: "Scattered",
    body: "Keep the useful context together.",
    footer: "Follow along as we build Wolds Record",
    logoPath: "assets/logo.png",
    photoPath: "assets/dog.png",
    imageOpacity: 18,
    safeMode: "airy",
    caption: "A channel-specific caption.",
    hashtags: ["woldsrecord", "caninetherapy", "caninemassage"],
    altText: "A Wolds Record graphic about scattered notes.",
  });
  assert.equal("publicImageUrl" in post, false);
  assert.equal("bufferPostId" in post, false);
  assert.equal("imagePath" in post, false);
});

test("the adapter rejects unknown asset IDs and arbitrary paths", () => {
  assert.throws(
    () => adaptDraftPostToLegacyPost({ ...draft, photoAssetId: "unknown" }, brand),
    (error: unknown) => error instanceof LegacyPostAdapterError && error.code === "asset_missing",
  );
  assert.throws(
    () => adaptDraftPostToLegacyPost(draft, { ...brand, logoPath: "https://example.com/logo.png" }),
    LegacyPostAdapterError,
  );
  assert.throws(
    () => adaptDraftPostToLegacyPost(draft, {
      ...brand,
      photoAssets: { "dog-one": "../private.png" },
    }),
    LegacyPostAdapterError,
  );
});

test("the application renderer reuses one session and serializes writes", async () => {
  const root = mkdtempSync(join(tmpdir(), "wr-app-renderer-"));
  const mediaRoot = join(root, "generated");
  const assets = join(root, "assets");
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(root, "instagram.html"), "<!doctype html>");
  writeFileSync(join(assets, "logo.png"), "logo");
  writeFileSync(join(assets, "dog.png"), "dog");
  const calls: string[] = [];
  let sessions = 0;

  try {
    const renderer = new StaticImageRenderer({
      repositoryRoot: root,
      mediaRoot,
      allowedAssetPaths: ["assets/logo.png", "assets/dog.png"],
      async loadRendererModule(){
        return {
          async createStaticImageRenderSession(){
            sessions += 1;
            return {
              async render(post){
                calls.push(`start:${post.id}`);
                await Promise.resolve();
                calls.push(`end:${post.id}`);
                return Buffer.from(`png:${post.id}`);
              },
              async close(){},
            };
          },
          writePngAtomically(path, png){
            mkdirSync(join(mediaRoot, "campaigns", "campaign-1"), { recursive: true });
            writeFileSync(path, png);
            return path;
          },
        };
      },
    });
    const post = adaptDraftPostToLegacyPost(draft, brand);

    await Promise.all([
      renderer.render({ post, relativeOutputPath: "campaigns/campaign-1/post-1.png" }),
      renderer.render({
        post: { ...post, id: "post-2" },
        relativeOutputPath: "campaigns/campaign-1/post-2.png",
      }),
    ]);

    assert.equal(sessions, 1);
    assert.deepEqual(calls, ["start:post-1", "end:post-1", "start:post-2", "end:post-2"]);
    assert.equal(readFileSync(join(mediaRoot, "campaigns/campaign-1/post-1.png"), "utf8"), "png:post-1");
    await renderer.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an unavailable browser maps to a stable safe error", async () => {
  const root = mkdtempSync(join(tmpdir(), "wr-browser-error-"));
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets/logo.png"), "logo");
  writeFileSync(join(root, "instagram.html"), "html");

  try {
    const renderer = new StaticImageRenderer({
      repositoryRoot: root,
      mediaRoot: join(root, "generated"),
      allowedAssetPaths: ["assets/logo.png"],
      async loadRendererModule(){
        return {
          async createStaticImageRenderSession(){ throw new Error("secret internal browser detail"); },
          writePngAtomically(){ throw new Error("not reached"); },
        };
      },
    });
    const post = adaptDraftPostToLegacyPost(
      { ...draft, photoAssetId: null },
      { ...brand, photoAssets: {} },
    );

    await assert.rejects(
      renderer.render({ post, relativeOutputPath: "campaigns/c/post.png" }),
      (error: unknown) => error instanceof StaticImageRenderError &&
        error.code === "browser_unavailable" &&
        !error.message.includes("secret internal"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing assets are rejected before a browser is launched", async () => {
  const root = mkdtempSync(join(tmpdir(), "wr-asset-error-"));
  writeFileSync(join(root, "instagram.html"), "html");
  let moduleLoads = 0;

  try {
    const renderer = new StaticImageRenderer({
      repositoryRoot: root,
      mediaRoot: join(root, "generated"),
      allowedAssetPaths: ["assets/logo.png"],
      async loadRendererModule(){
        moduleLoads += 1;
        throw new Error("must not load");
      },
    });
    const post = adaptDraftPostToLegacyPost(
      { ...draft, photoAssetId: null },
      { ...brand, photoAssets: {} },
    );

    await assert.rejects(
      renderer.render({ post, relativeOutputPath: "campaigns/c/post.png" }),
      (error: unknown) => error instanceof StaticImageRenderError && error.code === "asset_missing",
    );
    assert.equal(moduleLoads, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failed atomic write keeps the last good preview", async () => {
  const root = mkdtempSync(join(tmpdir(), "wr-write-error-"));
  const output = join(root, "generated/campaigns/c/post.png");
  mkdirSync(join(root, "assets"));
  mkdirSync(join(root, "generated/campaigns/c"), { recursive: true });
  writeFileSync(join(root, "assets/logo.png"), "logo");
  writeFileSync(join(root, "instagram.html"), "html");
  writeFileSync(output, "last-good");

  try {
    const renderer = new StaticImageRenderer({
      repositoryRoot: root,
      mediaRoot: join(root, "generated"),
      allowedAssetPaths: ["assets/logo.png"],
      async loadRendererModule(){
        return {
          async createStaticImageRenderSession(){
            return {
              async render(){ return Buffer.from("replacement"); },
              async close(){},
            };
          },
          writePngAtomically(){ throw new Error("disk unavailable"); },
        };
      },
    });
    const post = adaptDraftPostToLegacyPost(
      { ...draft, photoAssetId: null },
      { ...brand, photoAssets: {} },
    );

    await assert.rejects(
      renderer.render({ post, relativeOutputPath: "campaigns/c/post.png" }),
      (error: unknown) => error instanceof StaticImageRenderError && error.code === "write_failed",
    );
    assert.equal(readFileSync(output, "utf8"), "last-good");
    await renderer.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a hung render maps to render_timeout and never replaces the preview", async () => {
  const root = mkdtempSync(join(tmpdir(), "wr-timeout-"));
  const output = join(root, "generated/campaigns/c/post.png");
  mkdirSync(join(root, "assets"));
  mkdirSync(join(root, "generated/campaigns/c"), { recursive: true });
  writeFileSync(join(root, "assets/logo.png"), "logo");
  writeFileSync(join(root, "instagram.html"), "html");
  writeFileSync(output, "last-good");

  try {
    const renderer = new StaticImageRenderer({
      repositoryRoot: root,
      mediaRoot: join(root, "generated"),
      allowedAssetPaths: ["assets/logo.png"],
      timeoutMs: 5,
      async loadRendererModule(){
        return {
          async createStaticImageRenderSession(){
            return {
              render(){ return new Promise<Buffer>(() => undefined); },
              async close(){},
            };
          },
          writePngAtomically(){ throw new Error("must not write"); },
        };
      },
    });
    const post = adaptDraftPostToLegacyPost(
      { ...draft, photoAssetId: null },
      { ...brand, photoAssets: {} },
    );

    await assert.rejects(
      renderer.render({ post, relativeOutputPath: "campaigns/c/post.png" }),
      (error: unknown) => error instanceof StaticImageRenderError && error.code === "render_timeout",
    );
    assert.equal(readFileSync(output, "utf8"), "last-good");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

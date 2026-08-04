// Integration coverage for the Buffer draft payloads (acceptance criterion 4).
//
// Review finding S7: every other test is a pure-function test of the shared lib,
// so the actual payload construction -- the thing that decides what reaches a real
// social account -- had no automated coverage at all, and the image-regression
// guard was entirely manual. These drive the real CLI via --dry-run, which makes
// no network call.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "wr-payload-"));

function fixture(name, posts){
  const path = join(fixtureDir, `${name}.json`);
  writeFileSync(path, JSON.stringify({ posts }, null, 2));
  return path;
}

function dryRun(postsPath, postId){
  const stdout = execFileSync(
    process.execPath,
    ["scripts/create-buffer-draft.mjs", postsPath, postId, "--dry-run"],
    { env: { ...process.env, BUFFER_CHANNEL_ID: "test-channel" }, encoding: "utf8" }
  );

  return JSON.parse(stdout).input;
}

function dryRunFails(postsPath, postId){
  try{
    execFileSync(
      process.execPath,
      ["scripts/create-buffer-draft.mjs", postsPath, postId, "--dry-run"],
      { env: { ...process.env, BUFFER_CHANNEL_ID: "test-channel" }, encoding: "utf8", stdio: "pipe" }
    );
    return null;
  } catch(err){
    return { status: err.status, message: `${err.stderr || ""}`.trim() };
  }
}

const imagePost = {
  id: "img-1",
  service: "instagram",
  instagramType: "post",
  caption: "Caption text",
  hashtags: ["caninemassage"],
  publicImageUrl: "https://res.cloudinary.com/x/image/upload/img-1.png"
};

const reelPost = {
  id: "reel-1",
  format: "reel",
  service: "instagram",
  instagramType: "reel",
  template: "three-point-tip",
  caption: "Reel caption",
  hashtags: ["caninetherapy"],
  publicVideoUrl: "https://res.cloudinary.com/x/video/upload/reel-1.mp4"
};

test("an image post produces an image asset and post type", () => {
  const input = dryRun(fixture("image", [imagePost]), "img-1");

  assert.deepEqual(input.assets, [{ image: { url: imagePost.publicImageUrl } }]);
  assert.equal(input.metadata.instagram.type, "post");
  assert.equal(input.saveToDraft, true, "must never publish directly");
});

test("a record with no format is treated as an image post", () => {
  const legacy = { ...imagePost, id: "legacy-1" };
  delete legacy.format;

  const input = dryRun(fixture("legacy", [legacy]), "legacy-1");

  assert.ok(input.assets[0].image, "absent format must take the image path");
  assert.equal(input.metadata.instagram.type, "post");
});

test("a reel produces a video asset with a thumbnail offset and reel type", () => {
  const input = dryRun(fixture("reel", [reelPost]), "reel-1");

  assert.deepEqual(input.assets, [
    { video: { url: reelPost.publicVideoUrl, metadata: { thumbnailOffset: 2000 } } }
  ]);
  assert.equal(input.metadata.instagram.type, "reel");
  assert.equal(input.saveToDraft, true);
});

test("thumbnailOffset is overridable per record", () => {
  const input = dryRun(
    fixture("offset", [{ ...reelPost, id: "reel-off", thumbnailOffset: 3500 }]),
    "reel-off"
  );

  assert.equal(input.assets[0].video.metadata.thumbnailOffset, 3500);
});

test("caption and hashtags are preserved for both formats", () => {
  const image = dryRun(fixture("image", [imagePost]), "img-1");
  const reel = dryRun(fixture("reel", [reelPost]), "reel-1");

  assert.match(image.text, /Caption text/);
  assert.match(image.text, /#caninemassage/);
  assert.match(reel.text, /Reel caption/);
  assert.match(reel.text, /#caninetherapy/);
});

test("a reel without publicVideoUrl is rejected, not silently sent", () => {
  const naked = { ...reelPost, id: "reel-naked" };
  delete naked.publicVideoUrl;

  const failure = dryRunFails(fixture("naked", [naked]), "reel-naked");

  assert.ok(failure, "must fail rather than produce a payload");
  assert.notEqual(failure.status, 0);
  assert.match(failure.message, /publicVideoUrl/);
});

// Review finding S5.
test("format and instagramType must not disagree", () => {
  const mismatched = { ...reelPost, id: "reel-mismatch", instagramType: "post" };

  const failure = dryRunFails(fixture("mismatch", [mismatched]), "reel-mismatch");

  assert.ok(failure, "a reel declaring instagramType 'post' must be rejected");
  assert.notEqual(failure.status, 0);
  assert.match(failure.message, /conflicts with instagramType/);
});

test("a reel with no instagramType still defaults to reel, not post", () => {
  const untyped = { ...reelPost, id: "reel-untyped" };
  delete untyped.instagramType;

  const input = dryRun(fixture("untyped", [untyped]), "reel-untyped");

  assert.equal(input.metadata.instagram.type, "reel");
  assert.ok(input.assets[0].video, "a video asset must not be paired with a post type");
});

test("a reel cross-posts to the feed by default", () => {
  const input = dryRun(fixture("reel", [reelPost]), "reel-1");

  assert.equal(input.metadata.instagram.shouldShareToFeed, true);
});

test("a reel can opt out of the feed", () => {
  const input = dryRun(
    fixture("noshare", [{ ...reelPost, id: "reel-noshare", shouldShareToFeed: false }]),
    "reel-noshare"
  );

  assert.equal(input.metadata.instagram.shouldShareToFeed, false);
  assert.ok(input.assets[0].video, "opting out must not change the asset");
});

// A truthy "false" inverting the author's intent is the whole reason this is
// validated rather than passed through.
test("a non-boolean shouldShareToFeed is rejected, not coerced", () => {
  const failure = dryRunFails(
    fixture("badshare", [{ ...reelPost, id: "reel-badshare", shouldShareToFeed: "false" }]),
    "reel-badshare"
  );

  assert.ok(failure, "a string shouldShareToFeed must be rejected");
  assert.match(failure.message, /Invalid shouldShareToFeed/);
});

// Guards the live data itself: posts.json must keep producing the exact payload it
// produced before Reel support existed.
test("the live posts.json still produces image payloads", () => {
  const posts = JSON.parse(readFileSync("posts.json", "utf8")).posts;
  const sample = posts.find(post => post.publicImageUrl);

  const input = dryRun("posts.json", sample.id);

  assert.deepEqual(input.assets, [{ image: { url: sample.publicImageUrl } }]);
  assert.deepEqual(input.metadata.instagram, { type: "post", shouldShareToFeed: true });
});

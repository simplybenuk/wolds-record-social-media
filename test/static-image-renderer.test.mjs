import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  createStaticImageRenderSession,
  outputPathFor,
  postWithEmbeddedLocalImages,
  readPosts,
  writePngAtomically
} from "../scripts/lib/static-image-renderer.mjs";

function withTempDirectory(run){
  const directory = mkdtempSync(join(tmpdir(), "wr-static-renderer-"));

  try{
    return run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("legacy JSON inputs and default output paths keep their existing contract", () => {
  withTempDirectory(directory => {
    const arrayPath = join(directory, "array.json");
    const objectPath = join(directory, "object.json");
    const posts = [{ id: "post-one", imagePath: "generated/custom.png" }];
    writeFileSync(arrayPath, JSON.stringify(posts));
    writeFileSync(objectPath, JSON.stringify({ posts }));

    assert.deepEqual(readPosts(arrayPath), posts);
    assert.deepEqual(readPosts(objectPath), posts);
    assert.equal(outputPathFor(posts[0]), resolve("generated/custom.png"));
    assert.equal(outputPathFor({ id: "fallback" }), resolve("generated/fallback.png"));
    assert.equal(outputPathFor(posts[0], "chosen.png"), resolve("chosen.png"));
  });
});

test("local post assets are embedded while remote and empty values are preserved", () => {
  withTempDirectory(directory => {
    const imagePath = join(directory, "asset.png");
    writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const embedded = postWithEmbeddedLocalImages({
      logoPath: imagePath,
      photoPath: "https://example.invalid/photo.png"
    });

    assert.match(embedded.logoPath, /^data:image\/png;base64,/);
    assert.equal(embedded.photoPath, "https://example.invalid/photo.png");
    assert.equal(postWithEmbeddedLocalImages({ logoPath: "", photoPath: "" }).logoPath, "");
  });
});

test("one browser and page render multiple posts sequentially", async () => {
  const rendered = [];
  let launches = 0;
  let closes = 0;
  const png = Buffer.from("fake-png");
  const browser = {
    async newPage(options){
      assert.deepEqual(options.viewport, { width: 1400, height: 1600, deviceScaleFactor: 1 });
      return {
        async goto(url){ assert.match(url, /^file:/); },
        async waitForFunction(){},
        async evaluate(_callback, post){
          rendered.push(post.id);
          return `data:image/png;base64,${png.toString("base64")}`;
        }
      };
    },
    async close(){ closes += 1; }
  };

  const session = await createStaticImageRenderSession({
    htmlPath: "instagram.html",
    async launchBrowser(){ launches += 1; return browser; }
  });

  assert.deepEqual(await session.render({ id: "one", logoPath: "", photoPath: "" }), png);
  assert.deepEqual(await session.render({ id: "two", logoPath: "", photoPath: "" }), png);
  await session.close();

  assert.deepEqual(rendered, ["one", "two"]);
  assert.equal(launches, 1);
  assert.equal(closes, 1);
});

test("atomic replacement leaves only the complete final PNG", () => {
  withTempDirectory(directory => {
    const output = join(directory, "campaigns", "campaign", "post.png");
    const first = Buffer.from("first complete png");
    const second = Buffer.from("replacement complete png");

    writePngAtomically(output, first);
    assert.deepEqual(readFileSync(output), first);
    writePngAtomically(output, second);

    assert.deepEqual(readFileSync(output), second);
    assert.deepEqual(readdirSync(join(directory, "campaigns", "campaign")), ["post.png"]);
  });
});

test("missing CLI arguments still print usage and exit unsuccessfully", () => {
  assert.throws(
    () => execFileSync(process.execPath, ["scripts/render-post.mjs"], {
      cwd: resolve("."),
      encoding: "utf8",
      stdio: "pipe"
    }),
    error => error.status === 1 && /Usage:/.test(error.stdout)
  );
});

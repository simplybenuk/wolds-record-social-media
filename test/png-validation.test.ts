import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assertCompletePortraitSet, assertPortraitPng } from "../src/lib/rendering/png-validation.ts";
import { validPng } from "./png-fixture.ts";

test("preview validation rejects missing, corrupt, wrong-size and partial portrait sets", () => {
  const root = mkdtempSync(join(tmpdir(), "portrait-set-"));
  try {
    assert.throws(() => assertPortraitPng(root, "set/0.png"), /ENOENT|render_file_missing/);
    mkdirSync(join(root, "set"));
    writeFileSync(join(root, "set/0.png"), Buffer.from("not png"));
    assert.throws(() => assertPortraitPng(root, "set/0.png"), /render_png_invalid/);
    const syntheticHeader = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(syntheticHeader);
    syntheticHeader.writeUInt32BE(1080, 16); syntheticHeader.writeUInt32BE(1350, 20);
    writeFileSync(join(root, "set/0.png"), syntheticHeader);
    assert.throws(() => assertPortraitPng(root, "set/0.png"), /render_png_invalid/);
    writeFileSync(join(root, "set/0.png"), validPng(1080, 1080));
    assert.throws(() => assertPortraitPng(root, "set/0.png"), /render_dimensions_invalid/);
    const complete = validPng();
    writeFileSync(join(root, "set/0.png"), complete);
    assert.doesNotThrow(() => assertPortraitPng(root, "set/0.png"));
    writeFileSync(join(root, "set/0.png"), complete.subarray(0, complete.length - 8));
    assert.throws(() => assertPortraitPng(root, "set/0.png"), /render_png_truncated/);
    const corrupt = Buffer.from(complete); corrupt[corrupt.length - 5] ^= 1;
    writeFileSync(join(root, "set/0.png"), corrupt);
    assert.throws(() => assertPortraitPng(root, "set/0.png"), /render_png_crc_invalid/);
    writeFileSync(join(root, "set/0.png"), complete);
    assert.throws(() => assertCompletePortraitSet(root, ["set/0.png"], [0, 1]), /render_set_incomplete/);
    assert.throws(() => assertCompletePortraitSet(root, ["set/0.png", "set/0.png"], [0, 1]), /render_set_ordinal_mismatch/);
    writeFileSync(join(root, "set/extra.png"), validPng());
    assert.throws(() => assertCompletePortraitSet(root, ["set/0.png"], [0]), /render_set_files_mismatch/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

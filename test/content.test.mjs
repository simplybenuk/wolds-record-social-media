import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FORMAT,
  IMAGE_TEMPLATES,
  REEL_TEMPLATES,
  REEL_DURATION_DEFAULT,
  resolveFormat,
  isReel,
  templatesForFormat,
  resolveDuration,
  videoOutputPath,
  variablesPath,
  compositionPath,
  reelIssues,
  reelAssets,
  reelVariables,
  duplicateIds
} from "../scripts/lib/content.mjs";

// --- format resolution: the backward-compatibility guarantee -----------------

test("a record with no format defaults to image", () => {
  assert.equal(DEFAULT_FORMAT, "image");
  assert.equal(resolveFormat({ id: "legacy" }), "image");
  assert.equal(isReel({ id: "legacy" }), false);
});

test("explicit formats resolve as given", () => {
  assert.equal(resolveFormat({ format: "image" }), "image");
  assert.equal(resolveFormat({ format: "reel" }), "reel");
  assert.equal(isReel({ format: "reel" }), true);
});

test("an unknown format is rejected with a clear message", () => {
  assert.throws(() => resolveFormat({ format: "carousel" }), /Unknown format "carousel"/);
});

test("null, empty and blank formats all fall back to image", () => {
  assert.equal(resolveFormat({ format: null }), "image");
  assert.equal(resolveFormat({ format: "" }), "image");
  assert.equal(resolveFormat({ format: "   " }), "image");
  assert.equal(resolveFormat({}), "image");
  assert.equal(resolveFormat(undefined), "image");
});

test("a surrounding-whitespace format still resolves", () => {
  assert.equal(resolveFormat({ format: " reel " }), "reel");
});

// A hand-edited posts.json can hold any JSON type. These must surface as content
// errors, not as an internal TypeError from string handling.
test("a non-string format reports a content error, not a TypeError", () => {
  for(const value of [123, true, {}, []]){
    assert.throws(
      () => resolveFormat({ format: value }),
      err => err.constructor === Error && /Invalid format/.test(err.message),
      `format ${JSON.stringify(value)} should raise a clear content error`
    );
  }
});

// --- template selection ------------------------------------------------------

test("template allow-lists are scoped per format", () => {
  assert.deepEqual(templatesForFormat("image"), IMAGE_TEMPLATES);
  assert.deepEqual(templatesForFormat("reel"), REEL_TEMPLATES);
  assert.ok(!IMAGE_TEMPLATES.some(t => REEL_TEMPLATES.includes(t)), "namespaces must not overlap");
});

test("a reel template name is rejected on a reel record when unknown", () => {
  const issues = reelIssues(
    { id: "r", template: "problem", headline: "x" },
    { checkAssets: false }
  );
  assert.ok(issues.some(i => i.includes('unknown reel template "problem"')));
});

// --- output filename generation ---------------------------------------------

test("output paths are derived predictably from the content id", () => {
  const post = { id: "wolds-record-reel-001", template: "three-point-tip" };
  assert.equal(videoOutputPath(post), "generated/wolds-record-reel-001.mp4");
  assert.equal(variablesPath(post), "generated/wolds-record-reel-001.variables.json");
  assert.equal(compositionPath(post), "video/compositions/three-point-tip.html");
});

// --- duration validation -----------------------------------------------------

test("duration defaults when absent", () => {
  assert.equal(resolveDuration({}), REEL_DURATION_DEFAULT);
  assert.equal(resolveDuration({ duration: 20 }), 20);
});

test("out-of-range and non-integer durations are rejected", () => {
  const base = { id: "r", template: "three-point-tip", headline: "x", cta: "c", points: ["a", "b", "c"] };

  const tooShort = reelIssues({ ...base, duration: 1 }, { checkAssets: false });
  assert.ok(tooShort.some(i => i.includes("outside 3-90s")));

  const tooLong = reelIssues({ ...base, duration: 120 }, { checkAssets: false });
  assert.ok(tooLong.some(i => i.includes("outside 3-90s")));

  const fractional = reelIssues({ ...base, duration: 12.5 }, { checkAssets: false });
  assert.ok(fractional.some(i => i.includes("whole number")));

  const valid = reelIssues({ ...base, duration: 12 }, { checkAssets: false });
  assert.deepEqual(valid, []);
});

// --- per-template structural validation --------------------------------------

test("three-point-tip requires exactly three points", () => {
  const base = { id: "r", template: "three-point-tip", headline: "x", cta: "c" };

  assert.ok(reelIssues({ ...base, points: ["a", "b"] }, { checkAssets: false })
    .some(i => i.includes("exactly 3 points")));
  assert.ok(reelIssues({ ...base, points: ["a", "b", "c", "d"] }, { checkAssets: false })
    .some(i => i.includes("exactly 3 points")));
  assert.deepEqual(reelIssues({ ...base, points: ["a", "b", "c"] }, { checkAssets: false }), []);
});

test("product-feature requires at least one screenshot", () => {
  const base = { id: "r", template: "product-feature", headline: "x", cta: "c", points: ["benefit"] };
  assert.ok(reelIssues({ ...base, screenshots: [] }, { checkAssets: false })
    .some(i => i.includes("at least one screenshot")));
  assert.deepEqual(
    reelIssues({ ...base, screenshots: ["a.png"] }, { checkAssets: false }), []
  );
});

test("photo-story requires two or three scenes", () => {
  const base = { id: "r", template: "photo-story", headline: "x", cta: "c" };
  const scene = { photoPath: "p.png", caption: "c" };

  assert.ok(reelIssues({ ...base, scenes: [scene] }, { checkAssets: false })
    .some(i => i.includes("2-3 scenes")));
  assert.ok(reelIssues({ ...base, scenes: [scene, scene, scene, scene] }, { checkAssets: false })
    .some(i => i.includes("2-3 scenes")));
  assert.deepEqual(reelIssues({ ...base, scenes: [scene, scene] }, { checkAssets: false }), []);
});

test("a missing headline is reported", () => {
  const issues = reelIssues(
    { id: "r", template: "three-point-tip", points: ["a", "b", "c"] },
    { checkAssets: false }
  );
  assert.ok(issues.some(i => i === "missing headline"));
});

// --- missing asset handling --------------------------------------------------

test("missing asset files are reported by path", () => {
  const issues = reelIssues({
    id: "r",
    template: "three-point-tip",
    headline: "x",
    points: ["a", "b", "c"],
    photoPath: "assets/photos/definitely-not-here.png"
  });

  assert.ok(issues.some(i => i === "missing asset: assets/photos/definitely-not-here.png"));
});

test("asset checking can be skipped for schema-only validation", () => {
  const post = {
    id: "r",
    template: "three-point-tip",
    headline: "x",
    cta: "c",
    points: ["a", "b", "c"],
    photoPath: "assets/photos/definitely-not-here.png"
  };

  assert.deepEqual(reelIssues(post, { checkAssets: false }), []);
});

test("reelAssets collects every referenced local file", () => {
  const assets = reelAssets({
    photoPath: "p.png",
    logoPath: "l.png",
    screenshots: ["s1.png", "s2.png"],
    scenes: [{ photoPath: "sc1.png" }, { photoPath: "sc2.png" }]
  });

  assert.deepEqual(assets, ["p.png", "l.png", "s1.png", "s2.png", "sc1.png", "sc2.png"]);
});

// --- variables contract ------------------------------------------------------

test("reelVariables emits every declared key, with safe defaults", () => {
  const vars = reelVariables({ id: "r", headline: "H" });

  assert.deepEqual(Object.keys(vars).sort(), [
    "cta", "duration", "headline", "kicker", "logoPath",
    "photoPath", "points", "scenes", "screenshots"
  ]);
  assert.equal(vars.headline, "H");
  assert.equal(vars.kicker, "");
  assert.equal(vars.duration, REEL_DURATION_DEFAULT);
});

// HyperFrames 0.7.90 has no array variable type and --strict-variables rejects
// raw arrays, so list values cross the boundary JSON-encoded. Guarding this
// stops a future "tidy-up" from silently breaking every render.
test("list variables are JSON-encoded strings, not arrays", () => {
  const vars = reelVariables({
    id: "r",
    points: ["a", "b", "c"],
    screenshots: ["s.png"],
    scenes: [{ photoPath: "p.png", caption: "c" }]
  });

  for(const key of ["points", "scenes", "screenshots"]){
    assert.equal(typeof vars[key], "string", `${key} must cross as a string`);
  }

  assert.deepEqual(JSON.parse(vars.points), ["a", "b", "c"]);
  assert.deepEqual(JSON.parse(vars.screenshots), ["s.png"]);
  assert.deepEqual(JSON.parse(vars.scenes), [{ photoPath: "p.png", caption: "c" }]);
});

test("empty list variables encode as empty JSON arrays", () => {
  const vars = reelVariables({ id: "r" });

  assert.equal(vars.points, "[]");
  assert.equal(vars.scenes, "[]");
  assert.equal(vars.screenshots, "[]");
});

// Scalars must NOT be stringified -- duration is declared as a number.
test("scalar variables keep their types", () => {
  const vars = reelVariables({ id: "r", duration: 20, headline: "H" });

  assert.equal(typeof vars.duration, "number");
  assert.equal(vars.duration, 20);
  assert.equal(typeof vars.headline, "string");
});

// --- id uniqueness -----------------------------------------------------------

test("duplicate ids are detected", () => {
  assert.deepEqual(duplicateIds([{ id: "a" }, { id: "b" }]), []);
  assert.deepEqual(duplicateIds([{ id: "a" }, { id: "b" }, { id: "a" }]), ["a"]);
  assert.deepEqual(duplicateIds([{ id: "a" }, {}, { id: "a" }]), ["a"]);
});

// --- content integrity ------------------------------------------------------
//
// The compositions used to leave their own placeholder copy in the DOM whenever a
// value was empty, so a reel missing a caption rendered marketing text the operator
// never wrote. These rules stop such a record reaching the renderer at all.

test("a missing cta is reported for every template", () => {
  const cases = [
    { id: "r", template: "three-point-tip", headline: "h", points: ["a", "b", "c"] },
    { id: "r", template: "product-feature", headline: "h", screenshots: ["s.png"], points: ["b"] },
    { id: "r", template: "photo-story", headline: "h", scenes: [
      { photoPath: "p.png", caption: "c" }, { photoPath: "q.png", caption: "d" }
    ] }
  ];

  for(const post of cases){
    assert.ok(
      reelIssues(post, { checkAssets: false }).includes("missing cta"),
      `${post.template} should require a cta`
    );
  }
});

test("photo-story reports a scene missing its caption or photo", () => {
  const base = { id: "r", template: "photo-story", headline: "h", cta: "c" };

  const noCaption = reelIssues({
    ...base,
    scenes: [{ photoPath: "p.png" }, { photoPath: "q.png", caption: "d" }]
  }, { checkAssets: false });
  assert.ok(noCaption.includes("photo-story scene 1 is missing caption"));

  const noPhoto = reelIssues({
    ...base,
    scenes: [{ caption: "c" }, { photoPath: "q.png", caption: "d" }]
  }, { checkAssets: false });
  assert.ok(noPhoto.includes("photo-story scene 1 is missing photoPath"));
});

test("photo-story rejects non-object scenes", () => {
  const issues = reelIssues({
    id: "r", template: "photo-story", headline: "h", cta: "c",
    scenes: ["a", "b"]
  }, { checkAssets: false });

  assert.ok(issues.some(i => i.includes("must be an object with photoPath and caption")));
});

test("product-feature requires a benefit statement", () => {
  const issues = reelIssues({
    id: "r", template: "product-feature", headline: "h", cta: "c",
    screenshots: ["s.png"], points: []
  }, { checkAssets: false });

  assert.ok(issues.includes("product-feature needs a benefit statement in points[0]"));
});

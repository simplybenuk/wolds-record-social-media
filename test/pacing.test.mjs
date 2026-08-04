// The editor preview and the rendered MP4 derive scene timing from two separate
// copies of the same weights: video/compositions/*.html (authoritative, drives the
// real render) and buildScenes() in instagram.html (drives the preview). If they
// drift, the preview silently misrepresents pacing -- the operator approves timing
// the MP4 does not have. That drift was a real defect, not a hypothetical one.
//
// These tests extract the ORDERED weight sequence from each side and compare them,
// so a weight attached to the wrong scene fails even though every number still
// appears somewhere in the file.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editor = readFileSync(new URL("../instagram.html", import.meta.url), "utf8");

function composition(name){
  return readFileSync(new URL(`../video/compositions/${name}.html`, import.meta.url), "utf8");
}

// Matches either a literal `weight: 2.25` or a split such as `5.25 / count`
// (composition) / `5.25 / reel.screenshots.length` (editor), in source order.
const WEIGHT_PATTERN = /weight:\s*([0-9.]+)|([0-9.]+)\s*\/\s*(?:count|reel\.\w+\.length)/g;

function weightSequence(source){
  const weights = [];

  for(const match of source.matchAll(WEIGHT_PATTERN)){
    weights.push(Number(match[1] ?? match[2]));
  }

  return weights;
}

// Isolate one template's branch of buildScenes() so weights can't be matched
// against a different template's scenes.
function editorBranch(template){
  const start = editor.indexOf('function buildScenes(');
  assert.notEqual(start, -1, "buildScenes() should exist in instagram.html");

  const body = editor.slice(start, editor.indexOf("const weights =", start));

  const markers = {
    "three-point-tip": ['if(reel.template === "three-point-tip"){', '} else if(reel.template === "product-feature"){'],
    "product-feature": ['} else if(reel.template === "product-feature"){', "} else {"],
    "photo-story": ["} else {", null]
  };

  const [open, close] = markers[template];
  const from = body.indexOf(open);
  assert.notEqual(from, -1, `buildScenes should branch for ${template}`);

  const to = close ? body.indexOf(close, from) : body.length;
  return body.slice(from, to === -1 ? body.length : to);
}

// Authoritative sequences, in scene order, read from the compositions.
// Each totals 12 so a 12s reel maps 1:1 onto seconds.
const EXPECTED = {
  "three-point-tip": [3, 2.25, 2.25],
  "product-feature": [3, 5.25, 2.25, 1.5],
  "photo-story": [3, 6, 3]
};

for(const [name, expected] of Object.entries(EXPECTED)){
  test(`${name}: composition weight sequence is as specified`, () => {
    assert.deepEqual(weightSequence(composition(name)), expected);
  });

  test(`${name}: editor preview weight sequence matches the composition`, () => {
    assert.deepEqual(weightSequence(editorBranch(name)), expected);
  });
}

test("the guard actually catches drift", () => {
  // Prove the comparison is not vacuous: a mutated source must fail.
  const mutated = composition("three-point-tip").replace("weight: 3", "weight: 4");
  assert.notDeepEqual(weightSequence(mutated), EXPECTED["three-point-tip"]);

  // And prove branch isolation works: the three branches differ from each other.
  assert.notDeepEqual(
    weightSequence(editorBranch("three-point-tip")),
    weightSequence(editorBranch("product-feature"))
  );
});

test("product-feature preview includes the benefit scene the composition renders", () => {
  assert.ok(
    composition("product-feature").includes("scene-benefit"),
    "composition should render a benefit scene"
  );
  assert.ok(
    editorBranch("product-feature").includes('label: "Benefit"'),
    "editor preview must include the benefit scene, or it under-reports the scene count"
  );
});

test("compositions omit static data-duration so the duration variable governs length", () => {
  // A static data-duration is read at compile time, before JS runs, and would pin
  // every reel to that length regardless of its record.
  for(const name of Object.keys(EXPECTED)){
    assert.ok(
      !/data-duration\s*=/.test(composition(name)),
      `${name}.html must not declare a static data-duration`
    );
  }
});

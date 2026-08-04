// Guards the composition-level half of the placeholder-content defect.
//
// setText() used to return early on an empty value, leaving whatever static copy
// the composition shipped with. A reel missing a caption therefore rendered -- and
// could have published -- marketing copy the operator never wrote. Validation in
// scripts/lib/content.mjs is the first line of defence; this is the second, and it
// matters because `hyperframes preview` bypasses the CLI validation entirely.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// scene.js is a browser IIFE ending in `})(window)`. Load it against a stub.
function loadScene(){
  const source = readFileSync(new URL("../video/components/scene.js", import.meta.url), "utf8");
  const win = {};
  new Function("window", source)(win);
  return win.WRScene;
}

function fakeElement(initialText = ""){
  return {
    textContent: initialText,
    attributes: {},
    setAttribute(name, value){ this.attributes[name] = value; },
    removeAttribute(name){ delete this.attributes[name]; },
    getAttribute(name){ return this.attributes[name]; }
  };
}

const WRScene = loadScene();

test("setText clears placeholder copy instead of leaving it", () => {
  const el = fakeElement("Every session, written once and filed where you expect it.");

  const applied = WRScene.setText(el, "");

  assert.equal(applied, false, "an empty value is still reported as not applied");
  assert.equal(el.textContent, "", "the shipped placeholder must not survive");
});

test("setText clears on null, undefined and whitespace", () => {
  for(const value of [null, undefined, "   "]){
    const el = fakeElement("PLACEHOLDER MARKETING COPY");
    WRScene.setText(el, value);
    assert.equal(el.textContent, "", `value ${JSON.stringify(value)} must clear the element`);
  }
});

test("setText still applies real content", () => {
  const el = fakeElement("placeholder");

  const applied = WRScene.setText(el, "Notes live in several places");

  assert.equal(applied, true);
  assert.equal(el.textContent, "Notes live in several places");
});

test("setImage drops the placeholder src when no path is supplied", () => {
  const el = fakeElement();
  el.setAttribute("src", "/assets/photos/placeholder.png");

  const applied = WRScene.setImage(el, "");

  assert.equal(applied, false);
  assert.equal(el.getAttribute("src"), undefined, "placeholder image must not survive");
  assert.equal(el.getAttribute("data-wr-empty"), "true");
});

test("setImage applies a real path and clears the empty marker", () => {
  const el = fakeElement();
  el.setAttribute("data-wr-empty", "true");

  const applied = WRScene.setImage(el, "assets/photos/dog-image.png");

  assert.equal(applied, true);
  assert.ok(el.getAttribute("src").includes("dog-image.png"));
  assert.equal(el.getAttribute("data-wr-empty"), undefined);
});

// The list decoder is the boundary where JSON-encoded variables come back.
test("asList decodes JSON-encoded arrays and tolerates real arrays", () => {
  assert.deepEqual(WRScene.asList('["a","b"]'), ["a", "b"]);
  assert.deepEqual(WRScene.asList(["a", "b"]), ["a", "b"]);
  assert.deepEqual(WRScene.asList("[]"), []);
  assert.deepEqual(WRScene.asList(""), []);
});

test("asList does not throw on malformed JSON", () => {
  assert.doesNotThrow(() => WRScene.asList("[not valid json"));
});

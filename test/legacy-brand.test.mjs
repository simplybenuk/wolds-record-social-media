import assert from "node:assert/strict";
import test from "node:test";

import { resolveLegacyBrandPost } from "../scripts/lib/legacy-brand.mjs";

test("legacy CLI posts resolve non-Record identity from the selected pack", () => {
  const { post, warning } = resolveLegacyBrandPost({ brand: "massage", headline: "A calm start" });
  assert.equal(warning, null);
  assert.equal(post.kicker, "Wolds Canine Massage Therapy");
  assert.equal(post.handle, "@woldscaninemassage");
  assert.equal(post.logoPath, "assets/logos/wolds-canine-massage-logo.png");
  assert.equal(post.palette.deep, "#385933");
});

test("legacy Record posts keep their explicit rendering values", () => {
  const { post, warning } = resolveLegacyBrandPost({
    brand: "wolds-record",
    kicker: "Wolds Record",
    imageOpacity: 16,
    logoPath: "assets/logos/wolds-record-logo-transparent-small.png",
  });
  assert.equal(warning, null);
  assert.equal(post.imageOpacity, 16);
  assert.equal(post.logoPath, "assets/logos/wolds-record-logo-transparent-small.png");
});

test("unknown legacy brands warn and use Record identity", () => {
  const { post, warning } = resolveLegacyBrandPost({ brand: "sourlist" });
  assert.match(warning ?? "", /Unrecognised brand/);
  assert.equal(post.kicker, "Wolds Record");
  assert.equal(post.handle, "@woldsrecord");
});

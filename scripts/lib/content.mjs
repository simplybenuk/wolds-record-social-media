// Shared content-format helpers.
//
// The default-to-image rule lives here and nowhere else: any record without an
// explicit `format` is a static image post, which keeps every pre-Reel record in
// posts.json behaving exactly as it did before Reel support was added.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_FORMAT = "image";
export const FORMATS = ["image", "reel"];

export const IMAGE_TEMPLATES = ["problem", "feature", "hook", "cta"];
export const REEL_TEMPLATES = ["three-point-tip", "product-feature", "photo-story"];

export const REEL_DURATION_MIN = 3;
export const REEL_DURATION_MAX = 90;
export const REEL_DURATION_DEFAULT = 12;

export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const REEL_FPS = 30;

export function resolveFormat(post){
  const raw = post?.format;

  // Absent, null, or blank all mean "image" -- this is the backward-compatibility
  // guarantee for every record written before Reel support existed.
  if(raw === undefined || raw === null || raw === ""){
    return DEFAULT_FORMAT;
  }

  // A hand-edited posts.json can contain anything. Report it as a content problem
  // rather than letting a TypeError escape from .trim().
  if(typeof raw !== "string"){
    throw new Error(`Invalid format ${JSON.stringify(raw)}. Expected one of: ${FORMATS.join(", ")}.`);
  }

  const format = raw.trim();

  if(format === ""){
    return DEFAULT_FORMAT;
  }

  if(!FORMATS.includes(format)){
    throw new Error(`Unknown format "${format}". Expected one of: ${FORMATS.join(", ")}.`);
  }

  return format;
}

export function isReel(post){
  return resolveFormat(post) === "reel";
}

// Instagram only acts on shouldShareToFeed for Reels; on a feed post it is inert.
//
// The default is `true`: a Reel also lands on the main grid unless the record
// opts out. This is a deliberate distribution choice -- reach matters more than
// grid curation on this account -- not an inherited accident. Set
// `"shouldShareToFeed": false` on a post to keep that Reel out of the feed.
export const SHARE_TO_FEED_DEFAULT = true;

export function resolveShareToFeed(post){
  const raw = post?.shouldShareToFeed;

  if(raw === undefined || raw === null){
    return SHARE_TO_FEED_DEFAULT;
  }

  // A truthy string like "false" would silently invert the author's intent,
  // so refuse anything that isn't already a boolean.
  if(typeof raw !== "boolean"){
    throw new Error(`Invalid shouldShareToFeed ${JSON.stringify(raw)}. Expected true or false.`);
  }

  return raw;
}

export function templatesForFormat(format){
  return format === "reel" ? REEL_TEMPLATES : IMAGE_TEMPLATES;
}

export function resolveDuration(post){
  return Number.isFinite(post?.duration) ? post.duration : REEL_DURATION_DEFAULT;
}

export function videoOutputPath(post){
  return `generated/${post.id}.mp4`;
}

export function variablesPath(post){
  return `generated/${post.id}.variables.json`;
}

export function compositionPath(post){
  return `video/compositions/${post.template}.html`;
}

// Returns a list of human-readable problems. Empty means the reel is renderable.
export function reelIssues(post, { checkAssets = true } = {}){
  const issues = [];

  if(!post.id) issues.push("missing id");

  if(!post.template){
    issues.push("missing template");
  } else if(!REEL_TEMPLATES.includes(post.template)){
    issues.push(`unknown reel template "${post.template}" (expected: ${REEL_TEMPLATES.join(", ")})`);
  }

  if(!(post.headline || "").trim()) issues.push("missing headline");

  const duration = post.duration;

  if(duration !== undefined){
    if(!Number.isInteger(duration)){
      issues.push("duration must be a whole number of seconds");
    } else if(duration < REEL_DURATION_MIN || duration > REEL_DURATION_MAX){
      issues.push(`duration ${duration}s is outside ${REEL_DURATION_MIN}-${REEL_DURATION_MAX}s`);
    }
  }

  // Every template ends on a branded CTA slide. An empty cta now renders blank
  // rather than the composition's placeholder, so require it explicitly.
  if(!(post.cta || "").trim()) issues.push("missing cta");

  if(post.template === "three-point-tip"){
    const points = Array.isArray(post.points) ? post.points.filter(p => (p || "").trim()) : [];
    if(points.length !== 3){
      issues.push(`three-point-tip needs exactly 3 points (found ${points.length})`);
    }
  }

  if(post.template === "product-feature"){
    const shots = Array.isArray(post.screenshots) ? post.screenshots.filter(Boolean) : [];
    if(!shots.length) issues.push("product-feature needs at least one screenshot");

    // The benefit slide is sourced from points[0]. Without it the composition
    // previously fell back to the kicker, producing a slide reading "Wolds Record".
    const benefit = Array.isArray(post.points) ? (post.points[0] || "") : "";
    if(!benefit.trim()){
      issues.push("product-feature needs a benefit statement in points[0]");
    }
  }

  if(post.template === "photo-story"){
    const scenes = Array.isArray(post.scenes) ? post.scenes.filter(Boolean) : [];

    if(scenes.length < 2 || scenes.length > 3){
      issues.push(`photo-story needs 2-3 scenes (found ${scenes.length})`);
    }

    // Per-scene content: a scene missing a caption or photo used to render the
    // composition's placeholder copy over the operator's image.
    scenes.forEach((scene, index) => {
      const label = `photo-story scene ${index + 1}`;

      if(typeof scene !== "object" || Array.isArray(scene)){
        issues.push(`${label} must be an object with photoPath and caption`);
        return;
      }

      if(!(scene.photoPath || "").trim()) issues.push(`${label} is missing photoPath`);
      if(!(scene.caption || "").trim()) issues.push(`${label} is missing caption`);
    });
  }

  if(checkAssets){
    for(const assetPath of reelAssets(post)){
      if(!existsSync(resolve(assetPath))){
        issues.push(`missing asset: ${assetPath}`);
      }
    }
  }

  return issues;
}

export function reelAssets(post){
  const assets = [];

  if(post.photoPath) assets.push(post.photoPath);
  if(post.logoPath) assets.push(post.logoPath);

  if(Array.isArray(post.screenshots)){
    assets.push(...post.screenshots.filter(Boolean));
  }

  if(Array.isArray(post.scenes)){
    assets.push(...post.scenes.map(scene => scene?.photoPath).filter(Boolean));
  }

  return assets;
}

// The object handed to HyperFrames via --variables-file. Keys must match the
// data-composition-variables declared by each composition.
//
// HyperFrames 0.7.90 has no array variable type -- the only legal types are
// string | number | color | boolean | enum | font | image -- and --strict-variables
// rejects a raw array against every one of them. The list-valued keys are therefore
// JSON-encoded as strings, which the compositions decode at runtime. This keeps
// --strict-variables switched on, so a malformed variables file still fails the
// render rather than silently producing a wrong video.
const LIST_VARIABLES = ["points", "scenes", "screenshots"];

export function reelVariables(post){
  const variables = {
    headline: post.headline || "",
    kicker: post.kicker || "",
    cta: post.cta || "",
    points: Array.isArray(post.points) ? post.points : [],
    scenes: Array.isArray(post.scenes) ? post.scenes : [],
    screenshots: Array.isArray(post.screenshots) ? post.screenshots : [],
    photoPath: post.photoPath || "",
    logoPath: post.logoPath || "",
    duration: resolveDuration(post)
  };

  for(const key of LIST_VARIABLES){
    variables[key] = JSON.stringify(variables[key]);
  }

  return variables;
}

export function readPostsData(path){
  const data = JSON.parse(readFileSync(resolve(path), "utf8"));
  const posts = Array.isArray(data) ? data : data.posts;

  if(!Array.isArray(posts)){
    throw new Error("Expected a JSON array or an object with a posts array.");
  }

  return { data, posts };
}

export function writePostsData(path, data){
  writeFileSync(resolve(path), `${JSON.stringify(data, null, 2)}\n`);
}

export function findPost(posts, postId){
  const post = posts.find(item => item.id === postId);

  if(!post){
    throw new Error(`No post found with id "${postId}".`);
  }

  return post;
}

export function duplicateIds(posts){
  const seen = new Set();
  const duplicates = new Set();

  for(const post of posts){
    if(!post.id) continue;
    if(seen.has(post.id)) duplicates.add(post.id);
    seen.add(post.id);
  }

  return [...duplicates];
}

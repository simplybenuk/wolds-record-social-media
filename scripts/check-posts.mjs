#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { duplicateIds, reelIssues, resolveFormat, resolveShareToFeed } from "./lib/content.mjs";

function usage(){
  console.log(`Usage:
  node scripts/check-posts.mjs <posts-json>

Example:
  node scripts/check-posts.mjs posts.json
`);
}

function readPosts(path){
  const data = JSON.parse(readFileSync(resolve(path), "utf8"));
  const posts = Array.isArray(data) ? data : data.posts;

  if(!Array.isArray(posts)){
    throw new Error("Expected a JSON array or an object with a posts array.");
  }

  return posts;
}

function hasText(post){
  const hashtagsText = Array.isArray(post.hashtags)
    ? post.hashtags.join(" ")
    : post.hashtags || "";

  return Boolean((post.caption || "").trim())
    || Boolean(hashtagsText.trim());
}

function isInstagramPost(post){
  return post.service === "instagram"
    || post.platform === "instagram"
    || Boolean(post.instagramType);
}

function formatOf(post){
  try{
    return resolveFormat(post);
  } catch(err){
    return undefined;
  }
}

function postIssues(post, format){
  const issues = [];

  if(!post.id) issues.push("missing id");
  if(!format) issues.push(`unknown format "${post.format}"`);
  if(!hasText(post)) issues.push("missing caption/hashtags");

  if(format === "reel"){
    issues.push(...reelIssues(post, { checkAssets: false }));
  }

  if(isInstagramPost(post)){
    const declaredType = post.instagramType || post.postType;

    if(!declaredType){
      issues.push("missing instagramType");
    } else if(format){
      // `format` picks the asset shape, `instagramType` labels it for Buffer.
      // A mismatch produces a malformed draft, so flag it rather than guessing.
      const normalised = String(declaredType).trim().toLowerCase();

      if(format === "reel" && normalised !== "reel"){
        issues.push(`instagramType "${declaredType}" conflicts with format "reel"`);
      } else if(format !== "reel" && normalised === "reel"){
        issues.push(`instagramType "reel" conflicts with format "${format}"`);
      }
    }

    if(format === "reel"){
      if(!post.publicVideoUrl){
        issues.push("missing publicVideoUrl");
      }
    } else if(!post.publicImageUrl){
      issues.push("missing publicImageUrl");
    }

    // The draft creator refuses a non-boolean here, so catch it at check time
    // rather than at the point of writing to Buffer.
    try{
      resolveShareToFeed(post);
    } catch(err){
      issues.push(err.message);
    }
  }

  return [...new Set(issues)];
}

/* Known brand pack IDs and the legacy posts.json `brand` values that alias to
   them. Kept in step with src/features/campaigns/types.ts LEGACY_BRAND_ALIASES.
   An unrecognised value is a warning, never a blocking error: `brand` is a
   label the pipeline does not act on, and every live record predates packs. */
const KNOWN_BRAND_VALUES = new Set([
  "record", "massage", "academy",
  "wolds-record", "wolds-canine-massage", "wolds-canine-therapy-academy"
]);

function brandWarnings(post){
  if(post.brand === undefined || post.brand === null) return [];
  if(typeof post.brand !== "string" || !post.brand.trim()){
    return ["brand is set but empty"];
  }
  if(!KNOWN_BRAND_VALUES.has(post.brand.trim())){
    return [`unrecognised brand "${post.brand.trim()}"`];
  }
  return [];
}

function statusLabel(post, issues){
  if(post.bufferPostId || post.status === "sent_to_buffer"){
    return "sent";
  }

  if(issues.length){
    return "blocked";
  }

  return "ready";
}

function main(){
  const postsPath = process.argv[2];

  if(!postsPath){
    usage();
    process.exitCode = 1;
    return;
  }

  const posts = readPosts(postsPath);
  const counts = {
    ready: 0,
    blocked: 0,
    sent: 0
  };

  for(const post of posts){
    const format = formatOf(post);
    const issues = postIssues(post, format);
    const warnings = brandWarnings(post);
    const label = statusLabel(post, issues);
    counts[label] += 1;

    const parts = [
      `[${label}]`,
      post.id || "(missing id)",
      `format=${format || post.format || "unknown"}`,
      `status=${post.status || "unset"}`
    ];

    if(post.bufferPostId){
      parts.push(`bufferPostId=${post.bufferPostId}`);
    }

    if(warnings.length){
      parts.push(`warn: ${warnings.join("; ")}`);
    }

    // Cross-posting a Reel to the grid is not visible anywhere in the record
    // when it is left to the default, so state the effective value.
    if(format === "reel"){
      try{
        parts.push(`shareToFeed=${resolveShareToFeed(post)}`);
      } catch{
        parts.push("shareToFeed=invalid");
      }
    }

    if(issues.length){
      parts.push(`issues=${issues.join(", ")}`);
    }

    console.log(parts.join(" | "));
  }

  const duplicates = duplicateIds(posts);

  console.log("");

  if(duplicates.length){
    console.log(`Duplicate ids: ${duplicates.join(", ")}`);
    console.log("");
  }

  console.log(`Summary: ${counts.ready} ready, ${counts.blocked} blocked, ${counts.sent} sent`);
}

try{
  main();
} catch(err){
  console.error(err.message);
  process.exitCode = 1;
}

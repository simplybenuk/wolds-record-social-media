#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

function postIssues(post){
  const issues = [];

  if(!post.id) issues.push("missing id");
  if(!hasText(post)) issues.push("missing caption/hashtags");

  if(isInstagramPost(post)){
    if(!post.instagramType && !post.postType){
      issues.push("missing instagramType");
    }

    if(!post.publicImageUrl){
      issues.push("missing publicImageUrl");
    }
  }

  return issues;
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
    const issues = postIssues(post);
    const label = statusLabel(post, issues);
    counts[label] += 1;

    const parts = [
      `[${label}]`,
      post.id || "(missing id)",
      `status=${post.status || "unset"}`
    ];

    if(post.bufferPostId){
      parts.push(`bufferPostId=${post.bufferPostId}`);
    }

    if(issues.length){
      parts.push(`issues=${issues.join(", ")}`);
    }

    console.log(parts.join(" | "));
  }

  console.log("");
  console.log(`Summary: ${counts.ready} ready, ${counts.blocked} blocked, ${counts.sent} sent`);
}

try{
  main();
} catch(err){
  console.error(err.message);
  process.exitCode = 1;
}

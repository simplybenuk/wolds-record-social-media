#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ALLOWED_STATUSES = new Set([
  "draft",
  "rendered",
  "uploaded",
  "approved",
  "sent_to_buffer",
  "rejected",
  "published"
]);

function usage(){
  console.log(`Usage:
  node scripts/mark-post-status.mjs <posts-json> <post-id> <status> [--buffer-post-id=<id>]

Examples:
  node scripts/mark-post-status.mjs posts.json wolds-record-004-workflow uploaded
  node scripts/mark-post-status.mjs posts.json wolds-record-004-workflow sent_to_buffer --buffer-post-id=abc123
`);
}

function parseArgs(argv){
  const flags = {};
  const positional = [];

  for(const arg of argv){
    if(arg.startsWith("--buffer-post-id=")){
      flags.bufferPostId = arg.slice("--buffer-post-id=".length);
    } else {
      positional.push(arg);
    }
  }

  return {
    postsPath: positional[0],
    postId: positional[1],
    status: positional[2],
    bufferPostId: flags.bufferPostId
  };
}

function readPostsData(path){
  const data = JSON.parse(readFileSync(resolve(path), "utf8"));
  const posts = Array.isArray(data) ? data : data.posts;

  if(!Array.isArray(posts)){
    throw new Error("Expected a JSON array or an object with a posts array.");
  }

  return { data, posts };
}

function main(){
  const args = parseArgs(process.argv.slice(2));

  if(!args.postsPath || !args.postId || !args.status){
    usage();
    process.exitCode = 1;
    return;
  }

  if(!ALLOWED_STATUSES.has(args.status)){
    throw new Error(`Unsupported status "${args.status}". Allowed: ${Array.from(ALLOWED_STATUSES).join(", ")}`);
  }

  const { data, posts } = readPostsData(args.postsPath);
  const post = posts.find(item => item.id === args.postId);

  if(!post){
    throw new Error(`No post found with id "${args.postId}".`);
  }

  post.status = args.status;

  if(args.status === "sent_to_buffer"){
    post.sentToBufferAt = post.sentToBufferAt || new Date().toISOString();
  }

  if(args.bufferPostId){
    post.bufferPostId = args.bufferPostId;
  }

  writeFileSync(resolve(args.postsPath), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${args.postId} marked as ${args.status}`);
}

try{
  main();
} catch(err){
  console.error(err.message);
  process.exitCode = 1;
}

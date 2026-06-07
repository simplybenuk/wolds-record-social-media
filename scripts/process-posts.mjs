#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SKIP_STATUSES = new Set(["sent_to_buffer", "rejected", "published"]);

function usage(){
  console.log(`Usage:
  node scripts/process-posts.mjs <posts-json> (--prepare | --send-buffer | --all) [--dry-run] [--limit=<n>] [--force]

Examples:
  node scripts/process-posts.mjs posts.json --prepare --limit=10
  node scripts/process-posts.mjs posts.json --send-buffer --limit=10
  node scripts/process-posts.mjs posts.json --all --limit=10
  node scripts/process-posts.mjs posts.json --all --limit=10 --dry-run
`);
}

function parseArgs(argv){
  const args = {
    postsPath: undefined,
    mode: undefined,
    dryRun: false,
    limit: Infinity,
    force: false
  };

  for(const arg of argv){
    if(arg === "--prepare" || arg === "--send-buffer" || arg === "--all"){
      args.mode = arg.slice(2);
    } else if(arg === "--dry-run"){
      args.dryRun = true;
    } else if(arg === "--force"){
      args.force = true;
    } else if(arg.startsWith("--limit=")){
      args.limit = Number(arg.slice("--limit=".length));
    } else if(!args.postsPath){
      args.postsPath = arg;
    }
  }

  return args;
}

function readPosts(path){
  const data = JSON.parse(readFileSync(resolve(path), "utf8"));
  const posts = Array.isArray(data) ? data : data.posts;

  if(!Array.isArray(posts)){
    throw new Error("Expected a JSON array or an object with a posts array.");
  }

  return posts;
}

function activePosts(posts){
  return posts.filter(post => !SKIP_STATUSES.has(post.status) && !post.bufferPostId);
}

function postsNeedingPrepare(posts, force){
  return activePosts(posts).filter(post => force || !post.publicImageUrl);
}

function postsReadyForBuffer(posts){
  return activePosts(posts).filter(post => post.publicImageUrl);
}

function limitPosts(posts, limit){
  if(!Number.isFinite(limit)) return posts;
  return posts.slice(0, Math.max(0, limit));
}

async function run(command, args){
  console.log(`$ ${command} ${args.join(" ")}`);

  try{
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024 * 10
    });

    if(stdout.trim()) process.stdout.write(`${stdout.trim()}\n`);
    if(stderr.trim()) process.stderr.write(stderr);
  } catch(err){
    if(err.stdout) process.stdout.write(err.stdout);
    if(err.stderr) process.stderr.write(err.stderr);
    throw err;
  }
}

async function preparePosts(postsPath, limit, dryRun, force){
  const posts = limitPosts(postsNeedingPrepare(readPosts(postsPath), force), limit);

  if(!posts.length){
    console.log("No posts need render/upload preparation.");
    return;
  }

  for(const post of posts){
    await run(process.execPath, [
      "scripts/prepare-post.mjs",
      postsPath,
      post.id,
      ...(dryRun ? ["--dry-run"] : [])
    ]);
  }
}

async function sendPosts(postsPath, limit, dryRun){
  const posts = limitPosts(postsReadyForBuffer(readPosts(postsPath)), limit);

  if(!posts.length){
    console.log("No posts are ready to send to Buffer.");
    return;
  }

  for(const post of posts){
    await run(process.execPath, [
      "scripts/create-buffer-draft.mjs",
      postsPath,
      post.id,
      "--write-back",
      ...(dryRun ? ["--dry-run"] : [])
    ]);
  }
}

async function main(){
  const args = parseArgs(process.argv.slice(2));

  if(!args.postsPath || !args.mode || !Number.isFinite(args.limit) && args.limit !== Infinity){
    usage();
    process.exitCode = 1;
    return;
  }

  if(args.mode === "prepare"){
    await preparePosts(args.postsPath, args.limit, args.dryRun, args.force);
  } else if(args.mode === "send-buffer"){
    await sendPosts(args.postsPath, args.limit, args.dryRun);
  } else if(args.mode === "all"){
    await preparePosts(args.postsPath, args.limit, args.dryRun, args.force);
    await sendPosts(args.postsPath, args.limit, args.dryRun);
  } else {
    usage();
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});

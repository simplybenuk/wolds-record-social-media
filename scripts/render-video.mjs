#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import {
  compositionPath,
  findPost,
  readPostsData,
  reelIssues,
  reelVariables,
  resolveDuration,
  resolveFormat,
  variablesPath,
  videoOutputPath,
  writePostsData
} from "./lib/content.mjs";

const execFileAsync = promisify(execFile);

function usage(){
  console.log(`Usage:
  node scripts/render-video.mjs <posts-json> <post-id> [--dry-run] [--write-back]

Examples:
  node scripts/render-video.mjs posts.json wolds-record-reel-001
  node scripts/render-video.mjs posts.json wolds-record-reel-001 --dry-run
`);
}

function parseArgs(argv){
  const args = {
    postsPath: undefined,
    postId: undefined,
    dryRun: false,
    writeBack: false
  };

  for(const arg of argv){
    if(arg === "--dry-run"){
      args.dryRun = true;
    } else if(arg === "--write-back"){
      args.writeBack = true;
    } else if(!args.postsPath){
      args.postsPath = arg;
    } else if(!args.postId){
      args.postId = arg;
    }
  }

  return args;
}

function writeVariablesFile(post){
  const outputPath = resolve(variablesPath(post));

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(reelVariables(post), null, 2)}\n`);

  return outputPath;
}

function renderArgsFor(post, variablesFile, outputPath){
  return [
    "hyperframes",
    "render",
    "-c",
    compositionPath(post),
    "--variables-file",
    variablesFile,
    "--strict-variables",
    "-o",
    outputPath
  ];
}

async function render(command, args){
  try{
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024 * 10
    });

    // stdout of this script must stay JSON-only, so renderer chatter goes to stderr.
    if(stdout.trim()) process.stderr.write(`${stdout.trim()}\n`);
    if(stderr.trim()) process.stderr.write(stderr);
  } catch(err){
    if(err.stdout) process.stderr.write(err.stdout);
    if(err.stderr) process.stderr.write(err.stderr);
    throw new Error(`hyperframes render failed for ${args[args.length - 1]}: ${err.message}`);
  }
}

async function main(){
  const args = parseArgs(process.argv.slice(2));

  if(!args.postsPath || !args.postId){
    usage();
    process.exitCode = 1;
    return;
  }

  const { data, posts } = readPostsData(args.postsPath);
  const post = findPost(posts, args.postId);
  const format = resolveFormat(post);

  if(format !== "reel"){
    throw new Error(`Post "${post.id}" has format "${format}". Use scripts/render-post.mjs for image posts.`);
  }

  const issues = reelIssues(post);

  if(issues.length){
    for(const issue of issues){
      console.error(`${post.id}: ${issue}`);
    }

    throw new Error(`Reel "${post.id}" is not renderable (${issues.length} issue${issues.length === 1 ? "" : "s"}).`);
  }

  const outputPath = resolve(videoOutputPath(post));
  const variablesFile = resolve(variablesPath(post));
  const command = renderArgsFor(post, variablesFile, outputPath);

  if(args.dryRun){
    console.log(JSON.stringify({
      id: post.id,
      template: post.template,
      duration: resolveDuration(post),
      videoPath: outputPath,
      variablesFile,
      variables: reelVariables(post),
      command: `npx ${command.join(" ")}`
    }, null, 2));
    return;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeVariablesFile(post);

  await render("npx", command);

  if(args.writeBack){
    post.videoPath = outputPath;
    writePostsData(args.postsPath, data);
  }

  console.log(JSON.stringify({
    id: post.id,
    videoPath: outputPath,
    template: post.template,
    duration: resolveDuration(post)
  }, null, 2));
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});

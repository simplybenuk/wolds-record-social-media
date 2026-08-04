#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function usage(){
  console.log(`Usage:
  node scripts/prepare-video.mjs <posts-json> <post-id> [--dry-run]

Example:
  node scripts/prepare-video.mjs posts.json wolds-record-reel-001
  node scripts/prepare-video.mjs posts.json wolds-record-reel-001 --dry-run
`);
}

async function run(command, args){
  let result;

  try{
    result = await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024 * 10
    });
  } catch(err){
    if(err.stdout) process.stdout.write(err.stdout);
    if(err.stderr) process.stderr.write(err.stderr);
    throw err;
  }

  const { stdout, stderr } = result;

  if(stderr.trim()){
    process.stderr.write(stderr);
  }

  if(stdout.trim()){
    process.stdout.write(`${stdout.trim()}\n`);
  }

  return stdout;
}

function parseJsonOutput(output, label){
  try{
    return JSON.parse(output);
  } catch(err){
    throw new Error(`Could not parse ${label} output as JSON: ${err.message}`);
  }
}

async function main(){
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [postsPath, postId] = args.filter(arg => !arg.startsWith("--"));

  if(!postsPath || !postId){
    usage();
    process.exitCode = 1;
    return;
  }

  const renderOutput = await run(process.execPath, [
    "scripts/render-video.mjs",
    postsPath,
    postId
  ]);

  const rendered = parseJsonOutput(renderOutput, "render");

  await run(process.execPath, [
    "scripts/upload-cloudinary.mjs",
    postsPath,
    postId,
    `--video=${rendered.videoPath}`,
    "--write-back",
    ...(dryRun ? ["--dry-run"] : [])
  ]);
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});

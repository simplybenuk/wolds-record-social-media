#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const DEFAULT_CHROME_PATH = "/usr/bin/google-chrome";

function usage(){
  console.log(`Usage:
  node scripts/render-post.mjs <posts-json> <post-id> [--output=<path>]

Examples:
  node scripts/render-post.mjs posts.json wolds-record-005-dog-profile
  node scripts/render-post.mjs posts.json wolds-record-005-dog-profile --output=generated/custom.png
`);
}

function parseArgs(argv){
  const args = {
    postsPath: undefined,
    postId: undefined,
    output: undefined
  };

  for(const arg of argv){
    if(arg.startsWith("--output=")){
      args.output = arg.slice("--output=".length);
    } else if(!args.postsPath){
      args.postsPath = arg;
    } else if(!args.postId){
      args.postId = arg;
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

function outputPathFor(post, explicitOutput){
  if(explicitOutput) return resolve(explicitOutput);
  return resolve(post.imagePath || `generated/${post.id}.png`);
}

function mimeTypeFor(path){
  const ext = extname(path).toLowerCase();

  if(ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if(ext === ".webp") return "image/webp";
  if(ext === ".svg") return "image/svg+xml";
  return "image/png";
}

function localImageToDataUrl(path){
  if(!path || /^https?:\/\//i.test(path) || path.startsWith("data:")) return path;

  const absolutePath = resolve(path);

  if(!existsSync(absolutePath)) return path;

  const encoded = readFileSync(absolutePath).toString("base64");
  return `data:${mimeTypeFor(path)};base64,${encoded}`;
}

function postWithEmbeddedLocalImages(post){
  return {
    ...post,
    logoPath: localImageToDataUrl(post.logoPath),
    photoPath: localImageToDataUrl(post.photoPath)
  };
}

async function main(){
  const args = parseArgs(process.argv.slice(2));

  if(!args.postsPath || !args.postId){
    usage();
    process.exitCode = 1;
    return;
  }

  const posts = readPosts(args.postsPath);
  const post = posts.find(item => item.id === args.postId);

  if(!post){
    throw new Error(`No post found with id "${args.postId}".`);
  }

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH || DEFAULT_CHROME_PATH,
    headless: true,
    args: [
      "--disable-crash-reporter",
      "--disable-crashpad",
      "--disable-gpu",
      "--no-sandbox"
    ]
  });

  try{
    const page = await browser.newPage({
      viewport: {
        width: 1400,
        height: 1600,
        deviceScaleFactor: 1
      }
    });

    await page.goto(pathToFileURL(resolve("instagram.html")).href);
    await page.waitForFunction(() => typeof window.renderPostForExport === "function");

    const dataUrl = await page.evaluate(inputPost => window.renderPostForExport(inputPost), postWithEmbeddedLocalImages(post));
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    const outputPath = outputPathFor(post, args.output);

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, Buffer.from(base64, "base64"));

    console.log(JSON.stringify({
      postId: post.id,
      imagePath: outputPath
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});

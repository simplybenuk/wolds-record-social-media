#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

function readEnvFile(path = ".env"){
  if(!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for(const line of lines){
    const trimmed = line.trim();
    if(!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if(!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, "");

    if(process.env[key] === undefined){
      process.env[key] = value;
    }
  }
}

function usage(){
  console.log(`Usage:
  node scripts/upload-cloudinary.mjs <posts-json> <post-id> [--image=<path>] [--write-back] [--dry-run]

Examples:
  node scripts/upload-cloudinary.mjs posts.json wolds-record-005-dog-profile --image=generated/wolds-record-005-dog-profile.png
  node scripts/upload-cloudinary.mjs posts.json wolds-record-005-dog-profile --write-back
`);
}

function parseArgs(argv){
  const args = {
    postsPath: undefined,
    postId: undefined,
    image: undefined,
    writeBack: false,
    dryRun: false
  };

  for(const arg of argv){
    if(arg === "--write-back"){
      args.writeBack = true;
    } else if(arg === "--dry-run"){
      args.dryRun = true;
    } else if(arg.startsWith("--image=")){
      args.image = arg.slice("--image=".length);
    } else if(!args.postsPath){
      args.postsPath = arg;
    } else if(!args.postId){
      args.postId = arg;
    }
  }

  return args;
}

function readPostsData(path){
  const data = JSON.parse(readFileSync(resolve(path), "utf8"));
  const posts = Array.isArray(data) ? data : data.posts;

  if(!Array.isArray(posts)){
    throw new Error("Expected a JSON array or an object with a posts array.");
  }

  return { data, posts };
}

function requireEnv(name){
  const value = process.env[name];

  if(!value){
    throw new Error(`Missing ${name}. Add it to .env.`);
  }

  return value;
}

function signParams(params, apiSecret){
  const signatureBase = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== "")
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(`${signatureBase}${apiSecret}`).digest("hex");
}

function defaultPublicId(post, imagePath){
  const fileName = basename(imagePath, extname(imagePath));
  return post.cloudinaryPublicId || post.id || fileName;
}

async function uploadImage({ imagePath, post }){
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");
  const folder = process.env.CLOUDINARY_FOLDER || "";
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = defaultPublicId(post, imagePath);

  const signedParams = {
    folder,
    overwrite: "true",
    public_id: publicId,
    timestamp
  };

  const form = new FormData();
  form.set("file", new Blob([readFileSync(resolve(imagePath))], { type: "image/png" }), basename(imagePath));
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("public_id", publicId);
  form.set("overwrite", "true");

  if(folder){
    form.set("folder", folder);
  }

  form.set("signature", signParams(signedParams, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form
  });

  const body = await response.json();

  if(!response.ok){
    throw new Error(`Cloudinary upload failed: ${JSON.stringify(body)}`);
  }

  return body;
}

async function main(){
  readEnvFile();

  const args = parseArgs(process.argv.slice(2));

  if(!args.postsPath || !args.postId){
    usage();
    process.exitCode = 1;
    return;
  }

  const { data, posts } = readPostsData(args.postsPath);
  const post = posts.find(item => item.id === args.postId);

  if(!post){
    throw new Error(`No post found with id "${args.postId}".`);
  }

  const imagePath = args.image || post.imagePath;

  if(!imagePath){
    throw new Error("No image path provided. Pass --image=<path> or set imagePath on the post.");
  }

  if(!existsSync(resolve(imagePath))){
    throw new Error(`Image file does not exist: ${imagePath}`);
  }

  if(args.dryRun){
    const folder = process.env.CLOUDINARY_FOLDER || "";
    console.log(JSON.stringify({
      postId: post.id,
      imagePath: resolve(imagePath),
      cloudinaryFolder: folder,
      cloudinaryPublicId: defaultPublicId(post, imagePath),
      wouldWriteBack: args.writeBack
    }, null, 2));
    return;
  }

  const upload = await uploadImage({ imagePath, post });

  if(args.writeBack){
    post.publicImageUrl = upload.secure_url;
    post.cloudinaryPublicId = upload.public_id;
    post.status = "uploaded";
    post.uploadedAt = new Date().toISOString();
    writeFileSync(resolve(args.postsPath), `${JSON.stringify(data, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    postId: post.id,
    publicImageUrl: upload.secure_url,
    cloudinaryPublicId: upload.public_id
  }, null, 2));
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});

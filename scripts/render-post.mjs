#!/usr/bin/env node

import {
  createStaticImageRenderSession,
  outputPathFor,
  readPosts,
  writePng
} from "./lib/static-image-renderer.mjs";
import { resolveLegacyBrandPost } from "./lib/legacy-brand.mjs";

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

async function main(){
  const args = parseArgs(process.argv.slice(2));

  if(!args.postsPath || !args.postId){
    usage();
    process.exitCode = 1;
    return;
  }

  const posts = readPosts(args.postsPath);
  const sourcePost = posts.find(item => item.id === args.postId);

  if(!sourcePost){
    throw new Error(`No post found with id "${args.postId}".`);
  }

  const { post, warning } = resolveLegacyBrandPost(sourcePost);
  if(warning) console.error(warning);

  const renderer = await createStaticImageRenderSession();

  try{
    const png = await renderer.render(post);
    const outputPath = outputPathFor(post, args.output);

    writePng(outputPath, png);

    console.log(JSON.stringify({
      postId: post.id,
      imagePath: outputPath
    }, null, 2));
  } finally {
    await renderer.close();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});

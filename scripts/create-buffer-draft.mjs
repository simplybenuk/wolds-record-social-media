#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BUFFER_ENDPOINT = "https://api.buffer.com";

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
  node scripts/create-buffer-draft.mjs <posts-json> <post-id> [--dry-run] [--require-image] [--write-back]

Examples:
  node scripts/create-buffer-draft.mjs posts.example.json wolds-record-004-workflow --dry-run
  node scripts/create-buffer-draft.mjs posts.json wolds-record-004-workflow
  node scripts/create-buffer-draft.mjs posts.json wolds-record-004-workflow --write-back

Required env:
  BUFFER_API_KEY=...
  BUFFER_CHANNEL_ID=...
`);
}

function parseArgs(argv){
  const flags = new Set(argv.filter(arg => arg.startsWith("--")));
  const positional = argv.filter(arg => !arg.startsWith("--"));

  return {
    postsPath: positional[0],
    postId: positional[1],
    dryRun: flags.has("--dry-run"),
    requireImage: flags.has("--require-image"),
    writeBack: flags.has("--write-back")
  };
}

function readPostsData(path){
  const data = JSON.parse(readFileSync(resolve(path), "utf8"));
  const posts = Array.isArray(data) ? data : data.posts;

  if(!Array.isArray(posts)){
    throw new Error("Expected a JSON array or an object with a posts array.");
  }

  return { data, posts, isArrayRoot: Array.isArray(data) };
}

function writePostsData(path, data, isArrayRoot){
  const output = isArrayRoot ? data : data;
  writeFileSync(resolve(path), `${JSON.stringify(output, null, 2)}\n`);
}

function captionText(post){
  const caption = post.caption || "";
  const hashtags = Array.isArray(post.hashtags)
    ? post.hashtags.map(tag => tag.startsWith("#") ? tag : `#${tag}`).join(" ")
    : post.hashtags || "";

  return [caption.trim(), hashtags.trim()].filter(Boolean).join("\n\n");
}

function isInstagramPost(post){
  return post.service === "instagram"
    || post.platform === "instagram"
    || Boolean(post.instagramType)
    || process.env.BUFFER_CHANNEL_SERVICE === "instagram";
}

function buildCreateDraftInput(post){
  const channelId = post.bufferChannelId || process.env.BUFFER_CHANNEL_ID;

  if(!channelId){
    throw new Error("Missing BUFFER_CHANNEL_ID. Add it to .env or set post.bufferChannelId.");
  }

  const input = {
    text: captionText(post),
    channelId,
    schedulingType: "automatic",
    mode: "addToQueue",
    saveToDraft: true,
    source: "wolds-record-social-media"
  };

  if(isInstagramPost(post)){
    if(!post.publicImageUrl){
      throw new Error([
        "Instagram posts require a publicImageUrl.",
        `Render ${post.imagePath || "the post image"}, upload it to a public media host, then add that URL to this post.`
      ].join(" "));
    }

    input.metadata = {
      instagram: {
        type: post.instagramType || post.postType || "post",
        shouldShareToFeed: post.shouldShareToFeed ?? true
      }
    };
  }

  if(post.scheduledFor){
    input.dueAt = post.scheduledFor;
  }

  if(post.publicImageUrl){
    input.assets = [
      {
        image: {
          url: post.publicImageUrl
        }
      }
    ];
  }

  return input;
}

async function createBufferDraft(input){
  const apiKey = process.env.BUFFER_API_KEY;

  if(!apiKey){
    throw new Error("Missing BUFFER_API_KEY. Add it to .env or export it in your shell.");
  }

  const query = `
    mutation CreateDraftPost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            text
            dueAt
            channelId
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const response = await fetch(BUFFER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      query,
      variables: {
        input
      }
    })
  });

  const body = await response.json();

  if(!response.ok){
    throw new Error(`Buffer API returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  if(body.errors){
    throw new Error(`Buffer GraphQL errors: ${JSON.stringify(body.errors)}`);
  }

  const result = body.data?.createPost;

  if(result?.message){
    throw new Error(`Buffer mutation error: ${result.message}`);
  }

  if(!result?.post?.id){
    throw new Error(`Unexpected Buffer response: ${JSON.stringify(body)}`);
  }

  return result.post;
}

async function main(){
  readEnvFile();

  const args = parseArgs(process.argv.slice(2));

  if(!args.postsPath || !args.postId){
    usage();
    process.exitCode = 1;
    return;
  }

  const { data, posts, isArrayRoot } = readPostsData(args.postsPath);
  const post = posts.find(item => item.id === args.postId);

  if(!post){
    throw new Error(`No post found with id "${args.postId}".`);
  }

  if(args.requireImage && !post.publicImageUrl){
    throw new Error("This post has no publicImageUrl. Buffer cannot fetch local imagePath files.");
  }

  const input = buildCreateDraftInput(post);

  if(!input.text){
    throw new Error("Post has no caption/hashtags text to send to Buffer.");
  }

  if(args.dryRun){
    console.log(JSON.stringify({ input }, null, 2));
    return;
  }

  const createdPost = await createBufferDraft(input);

  if(args.writeBack){
    post.status = "sent_to_buffer";
    post.bufferPostId = createdPost.id;
    post.sentToBufferAt = new Date().toISOString();
    writePostsData(args.postsPath, data, isArrayRoot);
  }

  console.log(JSON.stringify(createdPost, null, 2));
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});

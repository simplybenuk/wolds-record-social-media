#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

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

async function bufferRequest(query, variables = {}){
  const apiKey = process.env.BUFFER_API_KEY;

  if(!apiKey){
    throw new Error("Missing BUFFER_API_KEY. Add it to .env or export it in your shell.");
  }

  const response = await fetch(BUFFER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  const body = await response.json();

  if(!response.ok){
    throw new Error(`Buffer API returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  if(body.errors){
    throw new Error(`Buffer GraphQL errors: ${JSON.stringify(body.errors)}`);
  }

  return body.data;
}

async function main(){
  readEnvFile();

  const accountData = await bufferRequest(`
    query GetOrganizations {
      account {
        organizations {
          id
          name
        }
      }
    }
  `);

  const organizations = accountData.account?.organizations || [];

  if(!organizations.length){
    throw new Error("No Buffer organizations returned for this API key.");
  }

  for(const organization of organizations){
    const channelsData = await bufferRequest(`
      query GetChannels($organizationId: OrganizationId!) {
        channels(input: {
          organizationId: $organizationId,
          filter: {
            isLocked: false
          }
        }) {
          id
          name
          displayName
          service
          isQueuePaused
        }
      }
    `, {
      organizationId: organization.id
    });

    console.log(`\n${organization.name} (${organization.id})`);

    for(const channel of channelsData.channels || []){
      console.log([
        `- ${channel.displayName || channel.name}`,
        `service=${channel.service}`,
        `id=${channel.id}`,
        `paused=${channel.isQueuePaused}`
      ].join(" | "));
    }
  }
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});

import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";

import * as schema from "./schema";

export type AppDatabase = ReturnType<typeof createDatabase>;

export function createDatabase(path = process.env.SOCIAL_STUDIO_DB_PATH ?? "./data/social-studio.sqlite") {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const client = new DatabaseSync(path);
  client.exec("PRAGMA foreign_keys = ON");
  client.exec([
    "CREATE TABLE IF NOT EXISTS __drizzle_migrations (",
    "id integer PRIMARY KEY,",
    "tag text NOT NULL UNIQUE,",
    "applied_at text NOT NULL",
    ")",
  ].join("\n"));
  const applied = client.prepare("SELECT tag FROM __drizzle_migrations WHERE tag = ?").get("0000_campaign_review");
  if (!applied) {
    client.exec("BEGIN IMMEDIATE");
    try {
      client.exec(readFileSync(resolve(process.cwd(), "drizzle/0000_campaign_review.sql"), "utf8"));
      client.prepare("INSERT INTO __drizzle_migrations (tag, applied_at) VALUES (?, ?)").run(
        "0000_campaign_review",
        new Date().toISOString(),
      );
      client.exec("COMMIT");
    } catch (error) {
      client.exec("ROLLBACK");
      throw error;
    }
  }
  // Drizzle's rc type overload does not preserve the node:sqlite client branch
  // when a schema is supplied, although this is the supported runtime shape.
  const orm = drizzle({ client, schema } as never);
  return { client, orm, close: () => client.close() };
}

let singleton: AppDatabase | undefined;
export function getDatabase() {
  singleton ??= createDatabase();
  return singleton;
}

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
  /* Apply every migration named in the drizzle journal, in order, once each.
     A migration that disables PRAGMA foreign_keys cannot run inside an explicit
     transaction — SQLite ignores the pragma there — so those files run
     statement by statement and re-enable foreign keys when they finish. */
  const journal = JSON.parse(
    readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
  ) as { entries: Array<{ idx: number; tag: string }> };

  const seen = client.prepare("SELECT tag FROM __drizzle_migrations").all() as Array<{ tag: string }>;
  const appliedTags = new Set(seen.map((row) => row.tag));

  for (const entry of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    if (appliedTags.has(entry.tag)) continue;

    const sqlText = readFileSync(
      resolve(process.cwd(), `drizzle/${entry.tag}.sql`),
      "utf8",
    );
    const disablesForeignKeys = /PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(sqlText);
    const record = () =>
      client.prepare("INSERT INTO __drizzle_migrations (tag, applied_at) VALUES (?, ?)").run(
        entry.tag,
        new Date().toISOString(),
      );

    if (disablesForeignKeys) {
      sqlText
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean)
        .forEach((statement) => client.exec(statement));
      record();
      client.exec("PRAGMA foreign_keys = ON");
      continue;
    }

    client.exec("BEGIN IMMEDIATE");
    try {
      client.exec(sqlText);
      record();
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

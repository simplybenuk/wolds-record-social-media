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
     SQLite's table-recreation procedure is "pragma outside, DDL inside": only
     the PRAGMA foreign_keys statements must sit outside a transaction, and the
     schema changes themselves belong in one so an interruption cannot leave a
     half-swapped database. */
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

    /* Statements are split so the pragmas can be hoisted out of the
       transaction. Matching is done per statement, not across the whole file,
       so a comment mentioning the pragma cannot change how a migration runs. */
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    /* Only a statement that is *nothing but* the pragma is hoisted. A file with
       no breakpoints is a single chunk of real DDL and must stay in the
       transaction even though it opens with a pragma line. */
    const isForeignKeyPragma = (statement: string) =>
      /^PRAGMA\s+foreign_keys\s*=\s*(ON|OFF)\s*;?$/i.test(
        statement.replace(/--[^\n]*/g, "").trim(),
      );
    const disablesForeignKeys = statements.some(
      (statement) => isForeignKeyPragma(statement) && /OFF/i.test(statement),
    );
    const body = statements.filter((statement) => !isForeignKeyPragma(statement));

    if (disablesForeignKeys) client.exec("PRAGMA foreign_keys = OFF");

    try {
      client.exec("BEGIN IMMEDIATE");
      try {
        for (const statement of body) client.exec(statement);

        /* foreign_key_check reports violations as rows, never as an error, so
           it has to be read back here — running it as a bare statement inside
           the migration would prove nothing. */
        if (disablesForeignKeys) {
          const violations = client.prepare("PRAGMA foreign_key_check").all();
          if (violations.length > 0) {
            throw new Error(
              `Migration ${entry.tag} left ${violations.length} foreign key violation(s); rolled back.`,
            );
          }
        }

        client.prepare("INSERT INTO __drizzle_migrations (tag, applied_at) VALUES (?, ?)").run(
          entry.tag,
          new Date().toISOString(),
        );
        client.exec("COMMIT");
      } catch (error) {
        client.exec("ROLLBACK");
        throw error;
      }
    } finally {
      // Always restored, including when the migration threw.
      client.exec("PRAGMA foreign_keys = ON");
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

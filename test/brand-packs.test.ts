import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createDatabase } from "../src/db/index.ts";
import {
  RECORD_PACK_ID,
  brandPackById,
  enabledBrandPacks,
  legacyRendererBrandFor,
  requireBrandPack,
  resolveBrand,
} from "../src/lib/brand/packs.ts";
import { brandPackSchema } from "../src/features/campaigns/schemas.ts";
import { recordBrandPack } from "../src/lib/brand/record.ts";

test("the Record pack reproduces today's five colours under semantic role names", () => {
  assert.deepEqual(recordBrandPack.visualStyle.palette, {
    paper: "#F4F1EC",
    ink: "#142836",
    inkSoft: "#666E6B",
    accent: "#D6A859",
    deep: "#2F5933",
  });
});

test("every enabled pack loads through one schema", () => {
  const packs = enabledBrandPacks();
  assert.ok(packs.length >= 1);
  for (const pack of packs) {
    assert.doesNotThrow(() => brandPackSchema.parse(pack));
  }
});

test("a pack missing a required field fails with that field named", () => {
  const { visualStyle, ...withoutVisualStyle } = recordBrandPack as Record<string, unknown>;
  const result = brandPackSchema.safeParse(withoutVisualStyle);
  assert.equal(result.success, false);
  assert.ok(
    result.success === false &&
      result.error.issues.some((issue) => issue.path.includes("visualStyle")),
  );
});

test("an invalid hex value is rejected", () => {
  const broken = structuredClone(recordBrandPack) as any;
  broken.visualStyle.palette.ink = "navy";
  assert.equal(brandPackSchema.safeParse(broken).success, false);
});

test("a pack declaring only a subset of the global pillars now loads", () => {
  const subset = structuredClone(recordBrandPack) as any;
  subset.contentPillars = ["record-keeping"];
  const result = brandPackSchema.safeParse(subset);
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
});

test("an unknown pillar is still rejected", () => {
  const unknown = structuredClone(recordBrandPack) as any;
  unknown.contentPillars = ["not-a-pillar"];
  assert.equal(brandPackSchema.safeParse(unknown).success, false);
});

test("the legacy wolds-record value resolves to the record pack without warning", () => {
  const resolved = resolveBrand("wolds-record");
  assert.equal(resolved.pack.id, RECORD_PACK_ID);
  assert.equal(resolved.warning, null);
});

test("an unknown brand warns and falls back to Record rather than failing", () => {
  const resolved = resolveBrand("sourlist");
  assert.equal(resolved.pack.id, RECORD_PACK_ID);
  assert.match(String(resolved.warning), /Unrecognised brand/);
});

test("an absent brand resolves to Record", () => {
  assert.equal(resolveBrand(undefined).pack.id, RECORD_PACK_ID);
  assert.equal(resolveBrand(null).warning, null);
});

test("renderer brand input is pack-derived, not hardcoded", () => {
  const brand = legacyRendererBrandFor(recordBrandPack);
  assert.equal(brand.kicker, recordBrandPack.displayName);
  assert.equal(brand.imageOpacity, recordBrandPack.visualStyle.imageOpacity);
  assert.equal(brand.handle, `@${recordBrandPack.instagramHandle}`);
  assert.deepEqual(brand.palette, recordBrandPack.visualStyle.palette);
});

/* WCAG AA for normal body text is 4.5:1. This is a blocking assertion: a pack
   failing it produces content Olivia would publish and could not read. */
function relativeLuminance(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test("every pack meets WCAG AA for body text", () => {
  for (const pack of enabledBrandPacks()) {
    const { paper, ink, inkSoft } = pack.visualStyle.palette;
    assert.ok(
      contrastRatio(ink, paper) >= 4.5,
      `${pack.id}: ink on paper is ${contrastRatio(ink, paper).toFixed(2)}:1`,
    );
    assert.ok(
      contrastRatio(inkSoft, paper) >= 4.5,
      `${pack.id}: inkSoft on paper is ${contrastRatio(inkSoft, paper).toFixed(2)}:1`,
    );
  }
});

test("the widened brand_id constraint applies to an empty database", () => {
  const database = createDatabase(":memory:");
  try {
    const row = database.client
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'campaigns'")
      .get() as { sql: string };
    assert.match(row.sql, /brand_id IN \('record', 'massage', 'academy'\)/);
    const fk = database.client.prepare("PRAGMA foreign_key_check").all();
    assert.deepEqual(fk, []);
  } finally {
    database.close();
  }
});

test("the widened constraint applies to a database already holding a Record campaign", () => {
  const directory = mkdtempSync(join(tmpdir(), "wolds-migration-"));
  const path = join(directory, "upgrade.sqlite");

  try {
    // Build a database at the pre-change schema: 0000 only.
    const legacy = new DatabaseSync(path);
    legacy.exec(
      "CREATE TABLE __drizzle_migrations (id integer PRIMARY KEY, tag text NOT NULL UNIQUE, applied_at text NOT NULL)",
    );
    legacy.exec(readFileSync(resolve(process.cwd(), "drizzle/0000_campaign_review.sql"), "utf8"));
    legacy
      .prepare("INSERT INTO __drizzle_migrations (tag, applied_at) VALUES (?, ?)")
      .run("0000_campaign_review", new Date().toISOString());
    legacy
      .prepare(
        `INSERT INTO campaigns (id, submission_key, brand_id, brief, post_count, start_date,
          end_date, status, generation_mode, model, created_at, updated_at)
         VALUES (?, ?, 'record', ?, 2, '2026-08-01', '2026-08-07', 'review', 'fixture', 'test', ?, ?)`,
      )
      .run("campaign-1", crypto.randomUUID(), "An existing Record campaign brief.", "t", "t");
    legacy.close();

    // Reopening runs the outstanding migration.
    const database = createDatabase(path);
    try {
      const rows = database.client
        .prepare("SELECT id, brand_id FROM campaigns")
        .all() as Array<{ id: string; brand_id: string }>;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, "campaign-1");
      assert.equal(rows[0].brand_id, "record");

      const ddl = database.client
        .prepare("SELECT sql FROM sqlite_master WHERE name = 'campaigns'")
        .get() as { sql: string };
      assert.match(ddl.sql, /brand_id IN \('record', 'massage', 'academy'\)/);

      assert.deepEqual(database.client.prepare("PRAGMA foreign_key_check").all(), []);
      assert.equal(
        (database.client.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys,
        1,
      );

      // The widened constraint accepts a new pack ID and still rejects nonsense.
      assert.throws(() =>
        database.client
          .prepare(
            `INSERT INTO campaigns (id, submission_key, brand_id, brief, post_count, start_date,
              end_date, status, generation_mode, model, created_at, updated_at)
             VALUES (?, ?, 'sourlist', ?, 1, '2026-08-01', '2026-08-02', 'review', 'fixture', 'test', ?, ?)`,
          )
          .run("campaign-2", crypto.randomUUID(), "A brief for an unknown brand.", "t", "t"),
      );
    } finally {
      database.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a prototype member is not mistaken for a brand pack", () => {
  for (const key of ["toString", "constructor", "valueOf", "__proto__"]) {
    assert.equal(brandPackById(key), undefined, `${key} resolved to a pack`);
    assert.throws(() => requireBrandPack(key), /Unknown brand pack/);
    assert.equal(resolveBrand(key).pack.id, RECORD_PACK_ID);
    assert.match(String(resolveBrand(key).warning), /Unrecognised brand/);
  }
});

test("an interrupted table-swap migration leaves the database usable", () => {
  const directory = mkdtempSync(join(tmpdir(), "wolds-migration-fail-"));
  const path = join(directory, "interrupted.sqlite");

  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(
      "CREATE TABLE __drizzle_migrations (id integer PRIMARY KEY, tag text NOT NULL UNIQUE, applied_at text NOT NULL)",
    );
    legacy.exec(readFileSync(resolve(process.cwd(), "drizzle/0000_campaign_review.sql"), "utf8"));
    legacy
      .prepare("INSERT INTO __drizzle_migrations (tag, applied_at) VALUES (?, ?)")
      .run("0000_campaign_review", new Date().toISOString());
    legacy
      .prepare(
        `INSERT INTO campaigns (id, submission_key, brand_id, brief, post_count, start_date,
          end_date, status, generation_mode, model, created_at, updated_at)
         VALUES (?, ?, 'record', ?, 1, '2026-08-01', '2026-08-02', 'review', 'fixture', 'test', ?, ?)`,
      )
      .run("campaign-1", crypto.randomUUID(), "A brief that must survive a failure.", "t", "t");
    // A leftover table forces the swap to fail partway through.
    legacy.exec("CREATE TABLE campaigns_new (wrong text)");
    legacy.close();

    assert.throws(() => createDatabase(path));

    // The rollback must leave the original table and its rows intact.
    const after = new DatabaseSync(path);
    try {
      const rows = after.prepare("SELECT id FROM campaigns").all() as Array<{ id: string }>;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, "campaign-1");
      const applied = after.prepare("SELECT tag FROM __drizzle_migrations").all() as Array<{ tag: string }>;
      assert.deepEqual(applied.map((row) => row.tag), ["0000_campaign_review"]);
    } finally {
      after.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the migration preserves dependent rows and both foreign key chains", () => {
  const directory = mkdtempSync(join(tmpdir(), "wolds-migration-deps-"));
  const path = join(directory, "deps.sqlite");

  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(
      "CREATE TABLE __drizzle_migrations (id integer PRIMARY KEY, tag text NOT NULL UNIQUE, applied_at text NOT NULL)",
    );
    legacy.exec(readFileSync(resolve(process.cwd(), "drizzle/0000_campaign_review.sql"), "utf8"));
    legacy
      .prepare("INSERT INTO __drizzle_migrations (tag, applied_at) VALUES (?, ?)")
      .run("0000_campaign_review", new Date().toISOString());
    legacy
      .prepare(
        `INSERT INTO campaigns (id, submission_key, brand_id, brief, post_count, start_date,
          end_date, status, generation_mode, model, created_at, updated_at)
         VALUES ('c1', ?, 'record', ?, 1, '2026-08-01', '2026-08-02', 'review', 'fixture', 'm', 't', 't')`,
      )
      .run(crypto.randomUUID(), "A brief with dependent rows attached.");
    legacy
      .prepare(
        `INSERT INTO generation_attempts (id, request_key, campaign_id, kind, mode, model,
          input_snapshot, brand_pack_version, status, request_started_at, created_at, updated_at)
         VALUES ('a1', ?, 'c1', 'campaign', 'fixture', 'm', '{}', 'v1', 'complete', 't', 't', 't')`,
      )
      .run(crypto.randomUUID());
    legacy
      .prepare(
        `INSERT INTO draft_posts (id, campaign_id, ordinal, format, brand_id, objective, pillar,
          proposed_date, visual_template, headline, body, footer, instagram_caption,
          facebook_caption, hashtags, alt_text, review_status, render_status,
          latest_generation_attempt_id, created_at, updated_at)
         VALUES ('p1', 'c1', 1, 'image', 'record', 'education', 'record-keeping', '2026-08-01',
          'problem', 'H', 'B', 'F', 'IC', 'FC', '[]', 'A', 'draft', 'pending', 'a1', 't', 't')`,
      )
      .run();
    legacy.close();

    const database = createDatabase(path);
    try {
      assert.deepEqual(database.client.prepare("PRAGMA foreign_key_check").all(), []);
      assert.equal(
        (database.client.prepare("SELECT count(*) AS n FROM draft_posts").get() as { n: number }).n,
        1,
      );

      const fks = database.client.prepare("PRAGMA foreign_key_list(draft_posts)").all() as Array<{
        table: string;
      }>;
      assert.deepEqual(
        fks.map((row) => row.table).sort(),
        ["campaigns", "generation_attempts"],
      );

      // UNIQUE (campaign_id, ordinal) must have survived the recreation.
      assert.throws(() =>
        database.client
          .prepare(
            `INSERT INTO draft_posts (id, campaign_id, ordinal, format, brand_id, objective, pillar,
              proposed_date, visual_template, headline, body, footer, instagram_caption,
              facebook_caption, hashtags, alt_text, review_status, render_status,
              latest_generation_attempt_id, created_at, updated_at)
             VALUES ('p2', 'c1', 1, 'image', 'record', 'education', 'record-keeping', '2026-08-01',
              'problem', 'H', 'B', 'F', 'IC', 'FC', '[]', 'A', 'draft', 'pending', 'a1', 't', 't')`,
          )
          .run(),
      );
    } finally {
      database.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

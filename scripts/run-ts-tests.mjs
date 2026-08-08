#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const tests = readdirSync(resolve("test"))
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => resolve("test", name));
const output = mkdtempSync(join(tmpdir(), "wolds-studio-tests-"));

await build({
  entryPoints: tests,
  outdir: output,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: "inline",
  packages: "bundle",
  external: ["playwright-core", "chromium-bidi/*"],
  alias: { "@": resolve("src") },
});

const result = spawnSync(process.execPath, ["--test", ...readdirSync(output)
  .filter((name) => name.endsWith(".js"))
  .map((name) => join(output, name))], { stdio: "inherit" });

process.exitCode = result.status ?? 1;

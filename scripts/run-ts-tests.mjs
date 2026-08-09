#!/usr/bin/env node

import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const tests = readdirSync(resolve("test"))
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => resolve("test", name));

// The bundle must live inside the repository. `playwright-core` is external, so the
// bundled tests resolve it at runtime by walking up from their own directory; an OS
// temp directory has no path to the repository's node_modules and the renderer then
// reports every real render as browser_unavailable.
const bundleRoot = resolve("node_modules", ".cache", "wolds-studio-tests");
mkdirSync(bundleRoot, { recursive: true });
const output = mkdtempSync(join(bundleRoot, "run-"));

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

rmSync(output, { recursive: true, force: true });

process.exitCode = result.status ?? 1;

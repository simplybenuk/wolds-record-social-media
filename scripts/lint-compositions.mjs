#!/usr/bin/env node

// Lints every reel composition.
//
// `hyperframes lint` takes a PROJECT DIRECTORY containing an index.html, not a
// file path. Pointed at this repo it reports "No composition found" and scans zero
// files -- while still returning errorCount: 0, which reads exactly like a pass.
// An earlier version of this change recorded "lint: 0 errors" from such a run.
//
// This script builds a throwaway project directory per composition (index.html
// symlinked to the composition, plus the asset and video trees it references) so
// the linter actually scans something, and it fails loudly if filesScanned is 0.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, symlinkSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { REEL_TEMPLATES } from "./lib/content.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(".");

async function lintComposition(template){
  const compositionPath = join(root, "video", "compositions", `${template}.html`);

  if(!existsSync(compositionPath)){
    throw new Error(`Composition not found: video/compositions/${template}.html`);
  }

  const projectDir = mkdtempSync(join(tmpdir(), `wr-lint-${template}-`));

  try{
    symlinkSync(compositionPath, join(projectDir, "index.html"));
    symlinkSync(join(root, "assets"), join(projectDir, "assets"));
    symlinkSync(join(root, "video"), join(projectDir, "video"));

    let stdout = "";

    try{
      ({ stdout } = await execFileAsync("npx", ["hyperframes", "lint", projectDir, "--json"], {
        maxBuffer: 1024 * 1024 * 10
      }));
    } catch(err){
      // A non-zero exit still carries the JSON report on stdout.
      stdout = err.stdout || "";
      if(!stdout.trim()) throw err;
    }

    const report = JSON.parse(stdout);

    // The failure mode this script exists to prevent: a "clean" report over
    // nothing at all.
    if(!report.filesScanned){
      throw new Error(
        `Linter scanned 0 files for ${template} -- the report is meaningless. ${report.error || ""}`.trim()
      );
    }

    return {
      template,
      ok: report.ok === true && report.errorCount === 0,
      errorCount: report.errorCount ?? 0,
      warningCount: report.warningCount ?? 0,
      filesScanned: report.filesScanned,
      findings: report.findings || []
    };
  } finally{
    rmSync(projectDir, { recursive: true, force: true });
  }
}

async function main(){
  const results = [];

  for(const template of REEL_TEMPLATES){
    results.push(await lintComposition(template));
  }

  for(const result of results){
    const status = result.ok ? "ok" : "FAIL";
    console.log(
      `[${status}] ${result.template} | files=${result.filesScanned} errors=${result.errorCount} warnings=${result.warningCount}`
    );

    for(const finding of result.findings){
      console.log(`    ${finding.severity || "info"}: ${finding.message}`);
    }
  }

  const failed = results.filter(result => !result.ok);

  console.log("");
  console.log(`Summary: ${results.length - failed.length} ok, ${failed.length} failed`);

  if(failed.length){
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});

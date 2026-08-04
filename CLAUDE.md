# Agent Notes

This repository is a lightweight social media automation workspace for Wolds Record.

These rules apply to every agent host. `AGENTS.md` carries the same content for hosts that read that file — **keep the two in sync when either changes.**

## Logging duty

Append a brief dated entry to `agents_log.txt` after making meaningful changes. Include:

- local timestamp
- short summary of files changed
- any important verification run
- any manual follow-up needed

Keep entries concise and factual. The log is append-only — never rewrite or delete prior entries. Do not store secrets, API keys, or private credentials in the log.

## Project adapter

Project-specific rules, validation commands, guardrails, and planning paths live in the adapter, not in this file:

- Adapter: `adapters/wolds-record-social-media/README.md`
- Context map: `adapters/wolds-record-social-media/context-map.md`

Read both before starting non-trivial work.

## Validation

Run after any change to `scripts/` or `posts.json`:

- `npm run check` — syntax-checks all `scripts/*.mjs`
- `npm run posts:check` — validates `posts.json`

There is no test framework configured in this repository.

## Guardrails

- Secrets live in `.env` (git-ignored) and are enumerated in `.env.example`. Never write real credential values into `posts.json`, logs, committed files, or workflow artifacts.
- `scripts/create-buffer-draft.mjs`, `process-posts.mjs`, `mark-post-status.mjs`, and `upload-cloudinary.mjs` write to **external services** (Buffer, Cloudinary). Publishing is outward-facing and effectively irreversible — get explicit human confirmation before any run that creates, schedules, or publishes a draft, or uploads media.
- `posts.json` holds live post content and status. Modify it only as the explicit subject of a change, and re-run `npm run posts:check` afterwards.

## Workflow artifacts

Planning documents live under `plans/`. See `plans/README.md` for the layout and lifecycle.

## Installed workflow

The BWH AI workflow is installed for two hosts: `.claude/` and `.agents/`. Each contains `skills/bwh-*`, `contracts/`, and a `bwh-ai-workflow.lock`. Keep both installs at the same revision.

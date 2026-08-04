# Host Conventions Contract

The workflow is agent-agnostic. Only the packaging and install layout differ per agent host. Skills, contracts, templates, and project artifacts must not name a specific agent product.

## Host resolution

Resolve the host from repository evidence, in this order:

1. An explicit host named by the user or recorded in `<agent-home>/bwh-ai-workflow.lock`.
2. An existing agent home directory in the project (`.claude/`, `.agents/`, or another documented location).
3. An existing agent instruction file (`CLAUDE.md`, `AGENTS.md`).
4. If none are present, ask which host to install for rather than guessing.

A project may host more than one agent. When several are present, treat each as a separate install target with its own agent home and lock file, and report all of them.

## Per-host mapping

| Host | Agent home | Instruction file | Plugin manifest | Skill invocation |
| --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | `CLAUDE.md` | `.claude-plugin/plugin.json` | `/bwh-<skill>` |
| Codex | `.agents/` | `AGENTS.md` | `.codex-plugin/plugin.json` | `$bwh-<skill>` |
| Other / unknown | ask, default `.agents/` | ask | none | host default |

## Layout invariants

Whatever the host, the installed layout must satisfy:

- Skills live in `<agent-home>/skills/bwh-*`.
- Contracts live in `<agent-home>/contracts/`, so that `../../contracts/<name>.md` resolves from any installed skill.
- The lock file lives at `<agent-home>/bwh-ai-workflow.lock`.
- The project adapter and context map live at the project's documented adapter location, outside the agent home, and are never host-specific.

Refer to the instruction file generically as "the project's agent instruction file" in skill output. Refer to skills by bare name (`bwh-spec`), not with a host's invocation prefix.

# Model Routing Contract

Keep skills and project artifacts model-agnostic. Model choice is an execution concern.

- Preserve the current reasoning effort as the baseline during a model migration.
- Compare the baseline with one lower effort on representative cases before increasing effort.
- Escalate based on ambiguity, trust-boundary risk, migration, security, rollout, recovery, or repeated validation failure—not task size alone.
- Record model, reasoning effort, latency, token usage, tool calls, retries, and outcome for eval runs.
- Keep workflow guardrails and validation requirements unchanged when the model changes.

# Workflow States

Use these states for persisted artifacts and handoffs:

```text
DRAFT
NEEDS REFINEMENT
READY FOR HUMAN APPROVAL
APPROVED FOR DEVELOPMENT
IN DEVELOPMENT
READY FOR HUMAN TESTING
NOT READY FOR HUMAN TESTING
ARCHIVED
```

Allowed transitions:

```text
DRAFT -> NEEDS REFINEMENT
DRAFT -> READY FOR HUMAN APPROVAL
NEEDS REFINEMENT -> READY FOR HUMAN APPROVAL
READY FOR HUMAN APPROVAL -> APPROVED FOR DEVELOPMENT  (human only)
APPROVED FOR DEVELOPMENT -> IN DEVELOPMENT
IN DEVELOPMENT -> READY FOR HUMAN TESTING
IN DEVELOPMENT -> NOT READY FOR HUMAN TESTING
NOT READY FOR HUMAN TESTING -> IN DEVELOPMENT
READY FOR HUMAN TESTING -> IN DEVELOPMENT  (human testing found more work)
READY FOR HUMAN TESTING -> ARCHIVED  (human acceptance and archive validation required)
```

`ARCHIVED` is terminal for a human-accepted change whose temporary change
documentation has been archived and verified. Supporting documents do not need
independent workflow states.

An agent must not advance an artifact through a human-only transition. An agent
must not infer human acceptance from review, automated tests, merged code,
inactivity, or implementation completion.

# ADR-002: Linear as the Authoritative Work Tracking System

**Status:** Accepted  
**Date:** 2026-04-04  
**Deciders:** Joel Greensite  

---

## Context

The project accumulated three parallel tracking mechanisms:

1. **`docs/backlog.json`** — A machine-readable JSON file with epics and stories
2. **Linear** — A hosted project management tool connected via MCP
3. **Session markdown artifacts** — Plans and reviews written during AI agent sessions

These diverged immediately. The backlog.json fell behind Linear. Stories were created in one but not the other. Agents spent time reconciling them rather than building.

## Decision

**Linear is the single source of truth for all work items.** The others are deprecated or repurposed.

Repo-scoped Linear automation must resolve through the local `bootstrapLocal` MCP server, using the explicit routing contract in `.repo-integrations.json`.

### What Goes Where

| Artefact | Location | Purpose |
|---|---|---|
| Epics, features, stories, priorities, assignments | **Linear only** | Live work tracking |
| Repo-aware Linear routing for automation | `.repo-integrations.json` in git | Explicit `bootstrapLocal` routing contract |
| *Why* architectural decisions were made | `docs/adr/` in git | Architecture Decision Records (ADRs), version-controlled |
| *How* to operate the system | `docs/runbooks/` in git | Operational procedures |
| Secret governance rules | `docs/secrets_management.md` in git | Compliance reference |
| Agent session workspace | `.gemini/brain/` (not committed) | Ephemeral scratch space |
| **`docs/backlog.json`** | **Deleted** | Superseded by Linear |

### Why Delete backlog.json?

- It will always be stale — any change in Linear is not reflected here automatically
- Maintaining it is pure overhead with zero benefit
- Agents can query Linear directly via `bootstrapLocal` with repo-enforced routing
- It blurs the line between "what to build" (Linear) and "how it's built" (ADRs)

### How AI Agents Use This System

Agents query Linear at the start of each session to understand the current backlog:

```
1. repo_context_resolve — confirm the repo resolves to the intended Linear workspace/team/project
2. linear_get_project_status — read the current project snapshot and recent issue activity
3. Execute the work
4. linear_update_issue — move or update the relevant issue when implementation changes its state
5. linear_create_comment — leave implementation notes tied to the issue
```

### ADR Format

ADRs in `docs/adr/` follow the format:
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: Why the decision was needed
- **Decision**: What was decided
- **Consequences**: Trade-offs

ADRs are immutable records — a new decision creates a new ADR that supersedes the old one.

## Consequences

✅ One source of truth — no reconciliation required  
✅ Agents can read and update Linear through `bootstrapLocal` with repo-enforced routing  
✅ Humans get Linear's full UX: assignments, sprints, notifications, GitHub integration  
✅ Architectural knowledge is version-controlled alongside the code it describes  
⚠️ Requires team discipline to keep Linear up to date  
⚠️ Legacy backlog files and scripts must stay out of the active workflow so the source of truth does not drift  

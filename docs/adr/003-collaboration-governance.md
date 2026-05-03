# ADR-003: Collaboration & Workspace Governance

**Status:** Accepted  
**Date:** 2026-04-04  
**Deciders:** Joel Greensite, Antigravity (Agent)

---

## Context

To maintain high velocity and ensure "hyperscaler" standards for the Rybform codebase, we need a clear separation between live work tracking, historical decisions, and ephemeral session data. Multiple redundant tracking systems (JSON, Markdown, Linear) were causing overhead and divergence.

## Decision

We will strictly adhere to the following "Keep/Remove" governance model for all future collaboration.

### The Governance Matrix

| Asset Type | Current Best Practice (KEEP) | Deprecated/Anti-Pattern (REMOVE) |
|---|---|---|
| **Work Tracking** | **Linear** — The authoritative source for all epics, features, stories, priorities, and sprints. Use `bootstrapLocal` for repo-scoped sync. | **`docs/backlog.json`** — Deleted. Manual JSON tracking is forbidden as it diverges from Linear automatically. |
| **Routing Contract** | **`.repo-integrations.json`** — Explicit repo-local routing for `bootstrapLocal` Linear actions. | Guessing project routing from repo name, UI state, or fuzzy search. |
| **Architecture** | **`docs/adr/`** — Version-controlled records of *why* specific engineering decisions were made (e.g., Hexagonal Architecture). | n/a |
| **Operations** | **`docs/runbooks/`** — Step-by-step guides for deployment, secret rotation, and incident response. | Loose markdown instructions scattered in session logs. |
| **Session Data** | **Ephemeral context** — Artifacts in `.gemini/brain/` describe the currently active session or complex research. | Permanent storage of "Implementation Plans" in the project root after the task is finished. |
| **Compliance** | **`docs/secrets_management.md`** — Rules for environment variable handling and audit logs. | n/a |

## Consequences

✅ Reduced context window bloat for AI agents  
✅ Single source of truth for humans and agents via Linear routed through `bootstrapLocal`  
✅ Permanent records are restricted to high-value architectural and operational documentation  
✅ The workspace remains clean and professional, suitable for due diligence at any time  

---

**Memory Record**:  
- **Linear**: Issues, sprints, priorities  
- **`.repo-integrations.json`**: Repo-local Linear routing contract  
- **docs/adr/**: Architectural reasoning  
- **docs/runbooks/**: Operational procedures  
- **DELETED**: `docs/backlog.json`  
- **EPHEMERAL**: Session artifacts (Plans/Walkthroughs)  

# ADR-001: Hexagonal Architecture (Ports & Adapters)

**Status:** Accepted  
**Date:** 2026-04-04  
**Deciders:** Joel Greensite  

---

## Context

The Rybform codebase started as a single-file React application (`App.tsx`). As the product grew to include authentication (Clerk), payments (Stripe), database persistence (Supabase), and CNC file generation (makerjs), vendor-specific code began spreading throughout the component tree.

The problem: **vendor lock-in and untestability**. Any refactoring of Clerk → Auth0, or Stripe → Paddle, would require touching dozens of files. No business logic could be tested in isolation without spinning up real third-party services.

## Decision

Adopt the **Ports & Adapters (Hexagonal Architecture)** pattern.

### Layer Model

```
┌──────────────────────────────────────────────────────────┐
│  UI Layer (React, Hooks)                                  │
│  src/App.tsx, src/components/, src/hooks/                │
│  — React-specific, depends on application layer          │
├──────────────────────────────────────────────────────────┤
│  Application Layer                                        │
│  src/core/application/                                   │
│  — Orchestration logic, vendor-agnostic, depends on ports│
│  — Pure TypeScript classes, no React                     │
├──────────────────────────────────────────────────────────┤
│  Port Interfaces                                          │
│  src/core/ports/                                         │
│  — TypeScript interfaces only, no implementations        │
│  — IAuthService, IDatabaseService, IPaymentService       │
├──────────────────────────────────────────────────────────┤
│  Domain Layer                                             │
│  src/core/domain/                                        │
│  — Pure TypeScript: types.ts, geometry.ts                │
│  — Zero imports from React, Three.js, or any vendor      │
└──────────────────────────────────────────────────────────┘
        ↕ (only via ports)
┌──────────────────────────────────────────────────────────┐
│  Infrastructure Adapters                                  │
│  src/infrastructure/adapters/                            │
│  — ClerkAuthAdapter, SupabaseDatabaseAdapter,            │
│    StripePaymentAdapter                                  │
│  — Implements port interfaces using vendor SDKs          │
│  — Wired together in main.tsx (Composition Root)         │
└──────────────────────────────────────────────────────────┘
```

### Dependency Rules (enforced by dependency-cruiser)

| Rule | Description |
|---|---|
| `core/` → `infrastructure/` | **FORBIDDEN** — core must not know about adapters |
| `core/` → vendor SDKs | **FORBIDDEN** — no @clerk, @supabase, stripe in core |
| `core/domain/` → React | **FORBIDDEN** — domain may not import UI framework |
| `hooks/` → `infrastructure/` | **FORBIDDEN** — hooks must not bypass the port boundary |

### What Hooks Are

React hooks (`src/hooks/`) are **UI-layer orchestration**, not application services. They:
- Are allowed to import from `core/application/` and `core/domain/`
- Are **not** allowed to import from `infrastructure/adapters/`
- May import React APIs (`useState`, `useCallback`, etc.)
- Are testable with react-testing-library but **not** in pure Node.js environments

### Composition Root

`main.tsx` is the **only** place where adapters are instantiated and injected. No other file constructs adapter instances.

## Consequences

✅ Business logic is vendor-agnostic and unit testable without mocking vendor SDKs  
✅ Vendor replacement (e.g., Clerk → Auth0) affects only one adapter file  
✅ Architecture violations are caught automatically by `dependency-cruiser` in CI  
⚠️ Requires discipline — App.tsx is the most common violation vector  
⚠️ Additional boilerplate for simple CRUD operations  

## Enforcement

```bash
# Run locally
npx depcruise src --config .dependency-cruiser.cjs

# CI (GitHub Actions — see EPIC-21)
npx depcruise src --config .dependency-cruiser.cjs --output-type err
```

Any PR that introduces a boundary violation must be blocked by CI.

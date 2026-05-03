# Rybform Architecture Guidelines

This document outlines the architectural boundaries established during our ARB review. We enforce a **Ports and Adapters (Hexagonal Architecture)** structure to strictly decouple Domain Logic from external tools, databases, and SDKs.

## Directory Structure
- **`src/core/`**: The Core Application boundary.
  - **`domain/`**: Contains pure business logic algorithms (e.g. geometric slice generation `geometry.ts`). Must NOT contain React UI or hooks.
  - **`ports/`**: TypeScript interfaces defining exact contracts for external dependencies (`IAuthService`, `IDatabaseService`).
  - **`services/`**: Application services bridging UI interactions with libraries (e.g., `ExportService` which abstracts `makerjs`).
  - **`application/`**: Contains Application logic and custom React state hooks (e.g., `useDesignerState`).

- **`src/infrastructure/`**: The outer layer carrying physical SDK integrations.
  - **`adapters/`**: Exact implementation of the defined `ports/` mapping logic exclusively to vendors (Clerk, Supabase, Stripe).
  - **`config/`**: Configuration for vendor SDK clients (`supabase.ts`, etc).

- **`src/` (root)**: The UI Layer. React orchestrators (`App.tsx`, `auth.tsx`) interact purely with `src/core/` and generic React primitives. 

## Enforcement
This boundary rule is strictly enforced by `dependency-cruiser` in the root configuration (`.dependency-cruiser.cjs`). Do not bypass constraints or add explicit Ignore exceptions unless approved by the CAB.

## Work Tracking Boundary
- Live work tracking belongs in Linear, not in committed JSON backlog files.
- Repo-scoped Linear reads and writes should go through the local `bootstrapLocal` MCP route.
- The repo-local routing contract for that flow is `.repo-integrations.json`.

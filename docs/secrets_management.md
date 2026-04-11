# DevSecOps & Secrets Management Governance

This document establishes the strict architectural boundary rules for handling external infrastructure credentials and platform secrets across local development, testing, and production (CI/CD) environments. Strict adherence is necessary to prevent leakage of critical parameters such as Stripe API keys and Supabase Service Role privileges.

## 1. Environment Topology

We utilize three distinct layers of environment variables determined by context:

| Context | Purpose | Configuration Scope |
|---|---|---|
| **Local Development** | Engineering and visual iteration | Variables injected via `.env.local`. Git-ignored. Safe for mock/test keys. |
| **CI/CD Pipeline** | Automated tests (Jest/Playwright) | Injected dynamically by GitHub Secrets. May run against test environments or mock servers. |
| **Production Server** | Final deployment hosting (Serverless / Express) | Managed inside the production host (e.g. Render / Cloudflare Workers). Never committed anywhere. |

## 2. Platform Segregation Rules

### Frontend (Vite/React)
- **Rule**: ONLY keys prefixed with `VITE_` are bundled into the compiled output.
- **Exposure**: These are *public*. They will be visible in the user's browser.
- **Allowed Keys**:
  - `VITE_CLERK_PUBLISHABLE_KEY` (Clerk Auth Public ID)
  - `VITE_STRIPE_PUBLISHABLE_KEY` (Stripe Form Loading ID)
  - `VITE_SUPABASE_URL` (Direct API URL for anonymous calls)
  - `VITE_SUPABASE_ANON_KEY` (Platform identification for anonymous/RLS database commands)
- **Forbidden**: Any backend service key, Stripe Secret Key, or Supabase Service Role Key. Exposing these on the frontend will result in an immediate architectural rejection.

### Backend (Express)
- **Rule**: Node components access standard `process.env` directly.
- **Exposure**: These operate within secure server memory and must never be echoed in client JSON responses.
- **Allowed Keys**:
  - `SUPABASE_URL` (Database endpoint — also needed server-side for service role access).
  - `SUPABASE_SERVICE_ROLE_KEY` (Bypass RLS for trusted actions like webhook writes).
  - `STRIPE_SECRET_KEY` (Generate secure checkout sessions).
  - `STRIPE_WEBHOOK_SECRET` (Validate that incoming payloads represent authentic Stripe webhooks).
  - `CLIENT_URL` (CORS origin allowlist — must match the deployed frontend domain).
  - `PORT` (Server listen port — overridden by hosting platform in production).

## 3. Playwright & Test Integrations

When executing End-To-End (E2E) integration tests via `npx playwright test`, mock configurations should be explicitly provided so that physical external state is isolated. For true integration tests demanding credentials, local environment variables `.env.test` will be sourced. CI platforms must supply these exact secret mappings via GitHub settings.

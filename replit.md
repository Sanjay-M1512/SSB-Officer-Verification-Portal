# SSB Officer Verification Portal

An officer-facing identity verification frontend for Sashastra Seema Bal personnel. It sends passport, Aadhaar or Driving Licence, and `.firpiv` fingerprint files to a configured Flask service and shows only backend-returned verification evidence.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/ssb-officer-portal run dev` — run the officer portal through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Frontend env: `VITE_API_BASE_URL` — Flask backend base URL, defaulting to `/api`
- Required env for the existing API server: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ssb-officer-portal/src/App.tsx` — login, dashboard, upload workflow, progress, and layered result views
- `artifacts/ssb-officer-portal/src/services/api.ts` — centralized health and multipart verification requests
- `artifacts/ssb-officer-portal/src/index.css` — portal theme, typography, responsive shell, and visual tokens
- `artifacts/ssb-officer-portal/.env.example` — frontend API base configuration example
- `attached_assets/Pasted-Build-a-production-style-demo-frontend-for-an-Indian-se_1789547437204.txt` — product requirements and backend contract notes

## Architecture decisions

- The frontend owns file selection, basic format checks, request submission, and result presentation; OCR, biometrics, liveness, and integrity decisions remain backend-owned.
- Verification results are retained only in the current browser session and are never seeded or fabricated.
- The API client defaults to same-origin `/api` while allowing `VITE_API_BASE_URL` to point at the existing Flask service.
- Login is intentionally isolated as a UI boundary until a real officer authentication endpoint is provided.

## Product

- Officer access surface with explicit non-production authentication handoff
- Backend connection health check
- Passport + Aadhaar/Driving Licence + `.firpiv` upload workflow
- Backend-driven progress, errors, and layered verification result review
- Safe display of low-risk identity fields with sensitive identifiers withheld

## User preferences

- No official government emblems are used; branding is text-based and neutral.
- Do not show fabricated verification records, scores, identities, statistics, or stage outcomes.

## Gotchas

- The current workspace does not include the existing Flask source, so the backend field names and response envelope beyond the provided example remain to be confirmed.
- The shared Express API server still exposes its scaffold health route at `/api/healthz`; set `VITE_API_BASE_URL` to the real Flask service before relying on `/health` and `/verify`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

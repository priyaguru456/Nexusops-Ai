# NexusOps AI - Testing Guide

This document describes the testing architecture, safety guards, mock providers, and execution commands for **NexusOps AI**.

---

## 1. Clean Checkout & Quick Start

From a fresh repository checkout, set up and run the entire test suite with the following steps:

```bash
# 1. Install root and workspace dependencies
npm install

# 2. Start PostgreSQL (with pgvector) and Redis containers
docker compose up -d

# 3. Initialize the separate test database with pgvector
npm --prefix apps/api run db:test:init
# Alternatively, via docker exec:
# docker exec -i nexusops-postgres psql -U postgres -d postgres -c "CREATE DATABASE nexusops_ai_test;" -c "\c nexusops_ai_test" -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Run Unit Tests (pure functions, no database required)
npm --prefix apps/api run test:unit
npm --prefix apps/web test

# 5. Run Integration Tests (against real test database)
npm --prefix apps/api run test:integration

# 6. Run Coverage Reporting (v8 coverage on core services)
npm --prefix apps/api run test:coverage
npm --prefix apps/web run test:coverage

# 7. Run Playwright E2E Tests (multi-role workflow against mock providers)
npm --prefix apps/web run test:e2e
```

---

## 2. Test Database Safety & Isolation

### Safety Guards
To guarantee that automated test runs can never wipe development or production data:
1. **Name Guard**: `apps/api/tests/setup/globalSetup.ts` inspects `DATABASE_URL_TEST` and throws a fatal error if the database name does not contain `test`.
2. **URL Guard**: `globalSetup.ts` checks that `DATABASE_URL_TEST !== DATABASE_URL`, preventing inadvertent execution against development databases.
3. **Automated Migrations**: Global setup executes `prisma migrate deploy` once against `nexusops_ai_test` at the start of integration test runs.
4. **Per-Test Table Truncation**: Between tests, `tests/setup/testSetup.ts` executes `TRUNCATE ... RESTART IDENTITY CASCADE` on all user-facing tables without using dev seeds.
5. **Sequential Execution**: API test files run with `fileParallelism: false` to eliminate database race conditions and state leakage.

---

## 3. Mocking Strategy

### External AI Providers
The API enforces mock mode through environment variables:
- `LLM_PROVIDER=anthropic|mock`
- `EMBEDDINGS_PROVIDER=openai|mock`
- **Production Guard**: `apps/api/src/config/env.ts` immediately terminates the process if `NODE_ENV === "production"` when mock providers are configured.

### Network Interception Guard
In `apps/api/tests/setup/testSetup.ts`, a global fetch interceptor blocks outgoing network requests to external AI endpoints:
- Intercepts requests matching `api.anthropic.com` or `api.openai.com` and throws an immediate test failure.
- Unit and integration tests run entirely offline with zero external API billable calls.

### Mock Capabilities
- **MockLLMProvider** (`apps/api/src/lib/llm.ts`):
  - Normal answers with citation markers `[1]`.
  - Fake/hallucinated citations `[99]` to verify stripping in post-processing.
  - Mid-stream abort errors to verify client disconnection cleanup.
  - Slow streaming with configurable token delays to verify client "Stop" button operation.
- **MockEmbeddingsProvider** (`apps/api/src/lib/embeddings.ts`):
  - Deterministic 1536-dimensional L2-normalized vectors generated via hash-based PRNG.

---

## 4. Test Suite Audit

Every test file in `apps/api/tests` was audited for its database interaction model:

| Test File | Description | Real DB or Mocked Prisma/SQL? | Notes / Conversion |
| :--- | :--- | :--- | :--- |
| `tests/unit/core-services.unit.test.ts` | Services: Auth, Approvals, Requests, Documents, Retrieval, Chat | Pure Unit (Mocked) | 48 comprehensive unit tests |
| `tests/unit/services.unit.test.ts` | Chunker, Prompt Builder, Citation Builder, RBAC | Pure Unit (No DB) | 18 tests passing |
| `tests/unit/time-and-escalation.unit.test.ts` | Fake Timers: JWT expiry, overdue tasks, escalation | Pure Unit (vi.useFakeTimers) | 3 tests passing |
| `tests/chunker.test.ts` | Text chunking, overlap, unicode, page preservation | Pure Unit (No DB) | 12 tests passing |
| `tests/errorHandler.test.ts` | Express error middleware & AppError HTTP codes | Pure Unit (No DB) | 4 tests passing |
| `tests/documents.test.ts` | Local file storage, path normalization, mime validation | Pure Unit (No DB) | 13 tests passing |
| `tests/sse-parser-and-citations.test.ts` | SSE text parsing, citation extraction | Pure Unit (No DB) | 7 tests passing |
| `tests/integration/auth.integration.test.ts` | Auth: registration, escalation block, refresh rotation, logout | Real Test DB | Supertest against `DATABASE_URL_TEST` |
| `tests/integration/requests.integration.test.ts` | Requests: lifecycle & illegal status transitions (409) | Real Test DB | Supertest against `DATABASE_URL_TEST` |
| `tests/integration/idor.integration.test.ts` | Table-driven IDOR protection across all `:id` routes | Real Test DB | Supertest against `DATABASE_URL_TEST` |
| `tests/integration/approvals.integration.test.ts` | Approvals: ordering, self-approval block, concurrent double-approve | Real Test DB | Supertest against `DATABASE_URL_TEST` |
| `tests/integration/documents-retrieval.integration.test.ts` | Documents: role visibility filtering, non-READY excluded | Real Test DB | Supertest against `DATABASE_URL_TEST` |
| `tests/integration/chat.integration.test.ts` | AI Chat: answer path, not-found path, fake citation stripped | Real Test DB | Supertest against `DATABASE_URL_TEST` |
| `tests/integration/analytics.integration.test.ts` | Analytics: role-scoped metrics and exact counts | Real Test DB | Supertest against `DATABASE_URL_TEST` |
| `tests/integration/unauthenticated-routes.integration.test.ts` | Security: every protected `/api` route without token returns 401 | Real Test DB | Supertest against `DATABASE_URL_TEST` |

---

## 5. Frontend Tests (React Testing Library)

Location: `apps/web/src`
- `routes/ProtectedRoute.test.tsx`: Redirects unauthenticated users to `/login`, renders 403 page for unauthorized roles, allows authorized roles.
- `components/layout/Sidebar.test.tsx`: Validates exact role-based navigation menus for Employee, Manager, and Admin.
- `features/auth/LoginForm.test.tsx`: Tests client-side validation errors, API submission, and server error banner rendering.
- `features/ai/MarkdownRenderer.test.tsx`: Verifies `[1]` citation marker transformation into interactive `CitationChip` and verifies XSS sanitization (scripts and onerror images are stripped).

---

## 6. Playwright E2E Suite

Location: `apps/web/e2e` & `apps/web/playwright.config.ts`
- **Config**: Chromium only, local webServers automatically spawning API + worker + web against `DATABASE_URL_TEST` with mock providers.
- **Fixture Data**: Deterministic seeding in `apps/web/e2e/global-setup.ts` using checked-in `tests/fixtures/leave-policy.pdf` (2-page PDF with exact leave policy sentences).
- **Multi-Role Workflow**:
  1. Employee logs in and creates a work request.
  2. Manager reviews and approves in the approval inbox.
  3. Fulfillment task appears for the assignee.
  4. Admin uploads `leave-policy.pdf` and waits for `READY` status.
  5. User queries AI about leave policy; response streams and displays citation chip linking to page 2.
- **Negative Flows**:
  - Employee cannot access `/admin/audit` (sees 403 Forbidden).
  - Employee querying an `ADMIN_ONLY` document receives the standard "not found" fallback.
  - "Stop" button successfully aborts an in-flight slow stream without breaking subsequent chat queries.

---

## 7. Service Coverage Reporting

Coverage threshold target: **70%+ lines** on core services and libraries.

| Module / Service | Lines Coverage | Status |
| :--- | :---: | :---: |
| `lib/chunker.ts` | **100%** | Passed (>= 70%) |
| `lib/textCleaner.ts` | **94.73%** | Passed (>= 70%) |
| `modules/ai/chat.service.ts` | **87.32%** | Passed (>= 70%) |
| `lib/errors.ts` | **85.71%** | Passed (>= 70%) |
| `modules/auth/auth.service.ts` | **84.90%** | Passed (>= 70%) |
| `modules/ai/retrieval.service.ts` | **84.90%** | Passed (>= 70%) |
| `modules/approvals/approval.service.ts` | **84.07%** | Passed (>= 70%) |
| `lib/storage/index.ts` | **83.33%** | Passed (>= 70%) |
| `modules/documents/document.service.ts` | **80.76%** | Passed (>= 70%) |
| `lib/jwt.ts` | **78.57%** | Passed (>= 70%) |
| `lib/llm.ts` | **73.52%** | Passed (>= 70%) |
| `modules/requests/request.service.ts` | **73.25%** | Passed (>= 70%) |
| `lib/queue.ts` | 21.42% | Auxiliary utility (below target) |
| `modules/audit/audit.service.ts` | 20.00% | Auxiliary utility (below target) |
| `modules/notifications/notification.service.ts` | 7.69% | Auxiliary utility (below target) |
| `modules/approvals/escalation.service.ts` | 2.50% | Cron background worker (below target) |
| `modules/tasks/task.service.ts` | 0.00% | Covered in integration suite |
| `modules/comments/comment.service.ts` | 0.00% | Covered in integration suite |
| `modules/users/user.service.ts` | 0.00% | Covered in integration suite |
| `modules/analytics/analytics.service.ts` | 0.00% | Covered in integration suite |
| `modules/search/search.service.ts` | 0.00% | Covered in integration suite |
| `lib/extractor.ts` | 0.00% | Covered via worker integration |

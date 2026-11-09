# NexusOps AI - Enterprise Operations Platform

NexusOps AI is an enterprise-grade internal operations and workflow platform. It unifies workforce management, service requests, multi-tier approval chains, compliance policy acknowledgments, IT asset tracking, leave calendars, expense claims, and knowledge retrieval powered by an AI assistant with source citations.

---

## 1. Architecture & Tech Stack

- **Frontend (`apps/web`)**:
  - React 19, TypeScript 5.8+, Vite 6, Tailwind CSS v4
  - TanStack React Query v5 (caching, deduplication, optimistic updates)
  - React Hook Form with Zod schema validation
  - Lucide React icons, Recharts for analytics data visualizations
  - Accessible design (ARIA attributes, keyboard navigation, focus management, light/dark mode)

- **Backend API (`apps/api`)**:
  - Node.js, Express 5, TypeScript 5.9+
  - Prisma ORM 6.19+ with PostgreSQL 16 & pgvector extension
  - Redis 7 & BullMQ for asynchronous background jobs (document processing, digest delivery, escalation checks)
  - JWT authentication (15m access token in header, 7d HTTP-only refresh cookie with token rotation)
  - Security suite: Helmet headers, strict CORS whitelist, Pino structured JSON logging, rate limiting (login, chat, password changes)
  - Multer with file type sanitization, path traversal prevention, and MIME verification

- **AI & RAG Engine**:
  - Multi-provider support (Anthropic Claude 3.5 Sonnet, OpenAI embeddings, or offline mock providers)
  - Text chunking (overlap, token counting) and vector similarity search via pgvector (1536-dim cosine similarity)
  - Verifiable citation mapping (`[n]` inline citations linked to source documents and page numbers)

---

## 2. Setup & Installation

### Prerequisites
- Node.js 20+ and npm 10+
- Docker and Docker Compose (for PostgreSQL with pgvector and Redis)

### Quick Start

```bash
# 1. Clone the repository and install root and workspace dependencies
git clone https://github.com/your-org/nexusops-ai.git
cd nexusops-ai
npm install

# 2. Configure environment variables
cp .env.example .env
cp apps/api/.env.example apps/api/.env

# 3. Start PostgreSQL (with pgvector) and Redis
docker compose up -d

# 4. Generate Prisma client & apply database migrations
npm --prefix apps/api run prisma:generate
npm --prefix apps/api run prisma:migrate

# 5. (Optional) Initialize the test database & seed demo data
npm --prefix apps/api run db:test:init
npm --prefix apps/api run seed:demo

# 6. Start API server & worker in separate terminals
# Terminal 1: API Server (http://localhost:4000)
npm --prefix apps/api run dev

# Terminal 2: Background Worker
npm --prefix apps/api run dev:worker

# Terminal 3: Web Application (http://localhost:5173)
npm --prefix apps/web run dev
```

### Verification Endpoints
- **API Health Check**: `GET http://localhost:4000/api/health`
- **Web Interface**: `http://localhost:5173`

---

## 3. Environment Variables Reference

| Variable | Default / Example | Description |
|---|---|---|
| `PORT` | `4000` | Port for Express API server |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `CLIENT_URL` | `http://localhost:5173` | Allowed origin for frontend redirect and links |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated whitelist of allowed CORS origins |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/nexusops_ai?schema=public` | Primary PostgreSQL database connection URL |
| `DATABASE_URL_TEST` | `postgresql://postgres:postgres@localhost:5433/nexusops_ai_test?schema=public` | Isolated test database URL (must contain `test` in name) |
| `DIRECT_URL` | `postgresql://postgres:postgres@localhost:5433/nexusops_ai?schema=public` | Direct database connection URL for migrations |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL for BullMQ queues and caching |
| `JWT_ACCESS_SECRET` | *32+ character random string* | Secret used to sign short-lived access JWTs |
| `JWT_REFRESH_SECRET` | *32+ character random string* | Secret used to sign refresh JWTs |
| `JWT_ACCESS_EXPIRES` | `15m` | Access token lifespan |
| `JWT_REFRESH_EXPIRES` | `7d` | Refresh token lifespan |
| `COOKIE_SECURE` | `false` (set `true` in prod) | Secure flag on HTTP-only refresh cookies |
| `BCRYPT_ROUNDS` | `10` | Salt rounds for password hashing |
| `UPLOAD_DIR` | `./uploads` | Safe local directory for validated file uploads |
| `MAX_UPLOAD_MB` | `20` | Maximum file upload size limit in megabytes |
| `LLM_PROVIDER` | `anthropic` (`mock` for tests) | Provider for AI assistant answers (`anthropic`, `mock`) |
| `EMBEDDINGS_PROVIDER` | `openai` (`mock` for tests) | Provider for vector embeddings (`openai`, `mock`) |
| `OPENAI_API_KEY` | `sk-...` | OpenAI API key for generating 1536-dim text embeddings |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Anthropic API key for Claude 3.5 Sonnet chat completion |
| `LLM_MODEL` | `claude-3-5-sonnet-20241022` | Model identifier for generation |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Model identifier for embeddings |
| `EMBEDDING_DIMENSIONS` | `1536` | Embedding vector dimensions for pgvector |
| `RAG_TOP_K` | `6` | Number of most similar document chunks to retrieve |
| `SIMILARITY_THRESHOLD` | `0.3` | Minimum cosine similarity required to pass chunks to LLM |
| `ESCALATION_AFTER_HOURS` | `72` | Hours before an overdue pending approval escalates |
| `ESCALATION_CHECK_INTERVAL_MINUTES` | `60` | Background interval for escalation checks |

---

## 4. Roles & Permissions (RBAC Matrix)

NexusOps AI enforces strict role-based access control on every backend route, paired with role-tailored frontend interfaces:

| Module / Action | Employee | Manager | Admin |
|---|:---:|:---:|:---:|
| **Authentication & Profile** |
| Login, Logout, Token Rotation, Password Change | Yes | Yes | Yes |
| View Own Profile & Activity History | Yes | Yes | Yes |
| **Directory & Organization** |
| Browse Employee Directory (Grid/Table view) | Yes | Yes | Yes |
| View Interactive Org Chart & Team Popovers | Yes | Yes | Yes |
| Manage Users (Create, Edit, Deactivate, Reassign) | No | No | **Yes** |
| **Work Requests & Approvals** |
| Submit New Request & Attach Files | Yes | Yes | Yes |
| View Own Requests & Timeline | Yes | Yes | Yes |
| View Direct Reports' Requests | No | **Yes** | **Yes** |
| Approve / Reject Pending Approval Step | No | **Yes** | **Yes** |
| Bulk Approve Requests with Comments | No | **Yes** | **Yes** |
| Manage Dynamic Approval Flows & Rules | No | No | **Yes** |
| **Task Management** |
| View Assigned Tasks & Update Status (Kanban / List) | Yes | Yes | Yes |
| Create & Assign Tasks to Others | No | **Yes** | **Yes** |
| Filter by "My Tasks", Priority, Due Date chips | Yes | Yes | Yes |
| **Company Policies & Compliance** |
| View Applicable Policies & Acknowledge Versions | Yes | Yes | Yes |
| View Compliance Overview (`/my-status`) | Yes | Yes | Yes |
| View Departmental Compliance Reports | No | **Yes** | **Yes** |
| Upload New Policy Documents & Increment Versions | No | No | **Yes** |
| **Announcements** |
| View Company & Department Announcements | Yes | Yes | Yes |
| Mark Announcements as Read | Yes | Yes | Yes |
| Create, Edit, Pin, or Target Announcements | No | No | **Yes** |
| **IT Asset Management** |
| View "My Assigned Assets" Tab | Yes | Yes | Yes |
| View Full Asset Inventory & Warranty Expirations | No | No | **Yes** |
| Register, Assign, Return, or Retire Assets | No | No | **Yes** |
| **Leaves & Calendar** |
| Apply for Leave (Casual, Sick, Annual, Unpaid) | Yes | Yes | Yes |
| View Personal Leave Balances & Kolkata Calendar | Yes | Yes | Yes |
| Approve / Reject Direct Reports' Leave Requests | No | **Yes** | **Yes** |
| Manage Company Holidays & Leave Types | No | No | **Yes** |
| **Expense Management** |
| Create Expense Claims, Add Items & Upload Receipts | Yes | Yes | Yes |
| Submit Expense Claims for Manager Approval | Yes | Yes | Yes |
| Approve / Reject Expense Claims | No | **Yes** | **Yes** |
| Finance Review & Mark Claims as Paid | No | No | **Yes** |
| **AI Assistant & Knowledge Base** |
| Query AI Chat with Citation Footnotes | Yes (Scoped) | Yes (Scoped) | **Yes (Full)** |
| Upload & Reprocess Knowledge Base Documents | No | No | **Yes** |
| View Document Processing Queue Status | No | No | **Yes** |
| **Audit Logs & Security** |
| View Immutable Append-Only Audit Logs | No | No | **Yes** |
| Filter by Actor, Action, Entity, Date Range & Export CSV | No | No | **Yes** |

---

## 5. Modules Overview

1. **Authentication & Identity (`/api/auth`)**:
   Session management with bcrypt hashing, access tokens in Authorization headers, secure HTTP-only refresh cookies, and rate-limited login endpoints.

2. **Employee Directory & Org Chart (`/api/directory`)**:
   Full organization directory with search, department filtering, role badges, interactive reporting tree, and manager-team modal popovers.

3. **Work Requests & Multi-Tier Approvals (`/api/requests`, `/api/approvals`, `/api/approval-flows`)**:
   Configurable approval workflows with category-based routing, monetary amount thresholds, step sequencing, self-approval prevention, SLA tracking, and 72-hour escalation timers.

4. **Task Management (`/api/tasks`)**:
   Team task assignment with statuses (`TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`), priority filters, quick due-date chips, and real-time updates.

5. **AI Assistant & Citation RAG (`/api/ai`)**:
   Enterprise knowledge assistant retrieving document chunks with pgvector cosine similarity. Answers include source citations that reference the original document title and page number.

6. **Knowledge Base Documents (`/api/documents`)**:
   Multi-format document ingestion (PDF, DOCX, TXT) with BullMQ background processing, text extraction, chunking, and embedding generation. Role-based visibility scopes (`ALL`, `DEPARTMENT`, `MANAGERS`, `ADMIN_ONLY`).

7. **Company Policies & Compliance (`/api/policies`)**:
   Version-controlled policies with mandatory acknowledgment tracking, departmental compliance metrics, and automated re-acknowledgment on version updates.

8. **Announcements (`/api/announcements`)**:
   Company-wide and department-targeted communications with priority flagging (`NORMAL`, `URGENT`), pin to top, expiration dates, and unread badges.

9. **IT Asset Inventory (`/api/assets`)**:
   Hardware and software asset lifecycle tracking (`AVAILABLE`, `ASSIGNED`, `IN_REPAIR`, `RETIRED`), serial numbers, warranty alerts, and request-to-assignment workflows.

10. **Leave Management & Calendar (`/api/leaves`, `/api/calendar`)**:
    Comprehensive time-off management with balance deductions, multi-day calculations, holiday exclusions, and calendar views localized to `Asia/Kolkata`.

11. **Expense Management (`/api/expenses`)**:
    Expense claim submission with itemized categories, receipt image/PDF uploads, minor unit (paise) integer financial arithmetic, manager approvals, and finance payment tracking.

12. **Notification Center (`/api/notifications`)**:
    Real-time notification bell with unread counters, in-app notification list, and deep links to relevant approvals, requests, and announcements.

13. **Immutable Audit Logs (`/api/audit-logs`)**:
    Append-only security log recording actor ID, IP address, entity references, state changes, and sanitized metadata with CSV export capabilities.

---

## 6. Testing

```bash
# Run backend unit tests (pure functions, mocks, 0 DB required)
npm --prefix apps/api run test:unit

# Run frontend tests with Vitest & React Testing Library
npm --prefix apps/web run test

# Run backend integration tests (requires docker compose up -d)
npm --prefix apps/api run test:integration

# Run full builds
npm --prefix apps/api run build
npm --prefix apps/web run build
```

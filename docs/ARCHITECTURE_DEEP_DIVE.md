# Comp AI — Architecture Deep Dive

## Table of Contents

1. [Monorepo Structure](#1-monorepo-structure)
2. [Technology Stack](#2-technology-stack)
3. [Authentication System](#3-authentication-system)
4. [RBAC & Permissions](#4-rbac--permissions)
5. [Database Schema](#5-database-schema)
6. [Policy Generation Pipeline](#6-policy-generation-pipeline)
7. [Integration Platform](#7-integration-platform)
8. [Vector / Embedding Pipeline](#8-vector--embedding-pipeline)
9. [Context Hub](#9-context-hub)
10. [Evidence Collection](#10-evidence-collection)
11. [Device Agent](#11-device-agent)
12. [Architecture Diagram](#12-architecture-diagram)
13. [Key Architectural Decisions](#13-key-architectural-decisions)

---

## 1. Monorepo Structure

```
comp/                          # Root
├── apps/                      # Applications
│   ├── api/                   # NestJS API (auth, RBAC, business logic)
│   ├── app/                   # Next.js 16 frontend (compliance dashboard)
│   ├── portal/                # Next.js 16 (employee portal)
│   ├── mcp-server/            # MCP server for AI agent integration
│   └── framework-editor/      # Framework authoring tool
├── packages/                  # Shared libraries
│   ├── auth/                  # RBAC permissions (single source of truth)
│   ├── db/                    # Prisma schema + client
│   ├── ui/                    # Legacy UI library (being phased out)
│   ├── company/               # Evidence form definitions
│   ├── email/                 # Email templates (react-email)
│   ├── integration-platform/  # Integration manifests + check runtime
│   ├── integrations/          # Legacy integration code
│   ├── device-agent/          # Electron desktop agent
│   ├── kv/                    # Redis client helper
│   ├── billing/               # Stripe billing logic
│   ├── analytics/             # Analytics client
│   ├── docs/                  # OpenAPI spec
│   └── utils/                 # Shared utilities
└── integrations-catalog/      # 583 integration metadata files
```

**Build system:** Turborepo v2.9.6 + Bun v1.3.4  
**Key decisions:**
- **Bun** over npm/yarn — faster installs, built-in test runner, TypeScript native
- **Turborepo** — parallel task execution, cached builds, dependency graph management
- **Separate apps** for API vs frontend — enables independent scaling, deployment, and technology choices per layer

---

## 2. Technology Stack

### 2.1 Why NestJS for the API (not Next.js API routes)?

| Concern | Next.js API Routes | NestJS |
|---------|-------------------|--------|
| **Architecture** | File-based, no structure enforcement | Modular (Controllers → Services → Repositories), Dependency Injection |
| **Validation** | Manual per-route | `ValidationPipe` + `class-validator` DTO decorators on every endpoint |
| **Auth guards** | Middleware or manual | `@UseGuards(HybridAuthGuard, PermissionGuard)` — declarative, composable |
| **RBAC** | No built-in pattern | `@RequirePermission('control', 'update')` — enforced at controller level |
| **OpenAPI docs** | Manual or next-swagger-doc | `@nestjs/swagger` auto-generates from DTO classes + decorators |
| **Testing** | SuperAgent on routes | `Test.createTestingModule` with DI mocking (`@nestjs/testing`) |
| **Rate limiting** | Manual middleware | `@nestjs/throttler` — `@Throttle()` decorator |
| **WebSockets** | No | `@nestjs/websockets` — real-time features |

**Why it matters:** Comp AI has 50+ data models, 583 integrations, complex RBAC with custom roles, multi-tenancy, background workflows, Stripe billing, and an MCP server. NestJS provides the structure to maintain this at scale. The team is actively **migrating away from Next.js server actions** toward calling the NestJS API for all data mutations.

### 2.2 Core Technology Table

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Backend** | NestJS 11 + Express | API server, DI, guards, pipes |
| **Frontend** | Next.js 16 + React 19 | Dashboard UI, App Router, SSR |
| **Styling** | Tailwind CSS 4 + CVA | Utility-first CSS + component variants |
| **Design System** | Radix UI + custom `@trycompai/design-system` | Accessible, themeable components |
| **ORM** | Prisma 7 | PostgreSQL ORM, migrations, client generation |
| **Auth** | better-auth | Session-based auth, OAuth (Google/GitHub/Microsoft), MCP OAuth |
| **Database** | PostgreSQL 15+ | Primary data store |
| **KV / Queue** | Upstash Redis | Sessions, rate limiting, chat history, queue |
| **Vector DB** | Upstash Vector | Embedding storage for semantic search |
| **AI SDK** | Vercel `ai` SDK + Groq | Unified AI interface, streaming |
| **LLM** | Groq (llama-3.1-8b-instant) | Policy generation, AI chat |
| **Embeddings** | OpenAI text-embedding-3-small | Vector embeddings for policies |
| **File Storage** | AWS S3 | Evidence uploads, org assets |
| **Email** | Resend | Transactional emails, passwordless login |
| **Workflows** | Trigger.dev | Background jobs (AI generation, document processing) |
| **Desktop Agent** | Electron + Vite | Device compliance monitoring |
| **Integrations** | Custom DSL + manifest system | 583 providers, OAuth2/API key/custom auth |
| **Billing** | Stripe | Subscription management, SKU-based pricing |

---

## 3. Authentication System

### 3.1 Architecture

```
Client Request
    │
    ▼
HybridAuthGuard (tried in order)
    │
    ├── 1. API Key (x-api-key header)
    │      → ApiKeyService.extractApiKey()
    │      → Sets authType='api-key', organizationId, apiKeyScopes
    │
    ├── 2. Service Token (x-service-token header)
    │      → resolveServiceByToken()
    │      → Requires x-organization-id header
    │      → Used for internal services (employee sync, device sync)
    │
    └── 3. Session (cookies or Bearer token)
           → better-auth api.getSession()
           → Cross-subdomain cookies (.trycomp.ai)
           → Sets userRoles, memberId, department
```

### 3.2 Why Session-based (not JWT)?

- **Cross-subdomain cookies** — all apps (app.trycomp.ai, portal.trycomp.ai, api.trycomp.ai) share the same session
- **No token management** — no refresh tokens, no expiry logic, no client-side storage
- **Server-controlled invalidation** — revoke sessions instantly from the server
- **MCP OAuth support** — extends to OAuth for AI agent access

### 3.3 Social Providers

| Provider | Config |
|----------|--------|
| **Google** | `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` |
| **GitHub** | `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` |
| **Microsoft** | `AUTH_MICROSOFT_CLIENT_ID` + `AUTH_MICROSOFT_CLIENT_SECRET` (tenant: common) |

### 3.4 Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/auth/auth.server.ts` | better-auth singleton configuration |
| `apps/api/src/auth/hybrid-auth.guard.ts` | Three-method auth guard |
| `apps/api/src/auth/permission.guard.ts` | Permission verification against metadata |
| `apps/api/src/auth/app-access.ts` | Role resolution + permission granting |

---

## 4. RBAC & Permissions

### 4.1 Permission Model

**Flat `resource:action` format** — single source of truth in `packages/auth/src/permissions.ts`:

```typescript
const statement = {
  organization: ['create', 'read', 'update', 'delete'],
  member:       ['create', 'read', 'update', 'delete'],
  control:      ['create', 'read', 'update', 'delete'],
  evidence:     ['create', 'read', 'update', 'delete'],
  policy:       ['create', 'read', 'update', 'delete'],
  risk:         ['create', 'read', 'update', 'delete'],
  vendor:       ['create', 'read', 'update', 'delete'],
  task:         ['create', 'read', 'update', 'delete'],
  framework:    ['create', 'read', 'update', 'delete'],
  audit:        ['create', 'read', 'update'],
  finding:      ['create', 'read', 'update', 'delete'],
  questionnaire:['create', 'read', 'update', 'delete'],
  integration:  ['create', 'read', 'update', 'delete'],
  apiKey:       ['create', 'read', 'delete'],
  app:          ['read'],                    // Main app access gate
  trust:        ['read', 'update'],
  pentest:      ['create', 'read', 'delete'],
  portal:       ['read', 'update'],
  secret:       ['create', 'read', 'update', 'delete'],
};
```

### 4.2 Built-in Roles

| Role | Access | Used By |
|------|--------|---------|
| **owner** | Full access (except finding: read/update only) | Company founders |
| **admin** | Same as owner minus `organization: delete` | IT/Security leads |
| **auditor** | Read-only GRC + create findings | External auditors |
| **employee** | Portal-only: `policy:read`, `portal:read/update` | All employees |
| **contractor** | Same as employee | Contractors/temps |

### 4.3 Custom Roles

Stored in `OrganizationRole` table — JSON permissions field, max 100 per org. Merged with built-in roles at runtime via `resolveRolePermissions()`.

### 4.4 Frontend Gating

```
canAccessRoute(permissions, 'policies')    → Nav item visibility
hasPermission(permissions, 'policy', 'update') → Button enabled/disabled
requireRoutePermission('policies', orgId)   → Page-level server check
```

**Route permissions** defined in `apps/app/src/lib/permissions.ts` — maps URL segments to required permissions.

---

## 5. Database Schema

### 5.1 Entity Relationship Diagram (Text)

```
Organization
    │
    ├── Member (user + role + department)
    │     ├── User (email, name, accounts, sessions)
    │     ├── OrganizationRole (custom permissions JSON)
    │     ├── Policy (content, status, versions)
    │     │     └── PolicyVersion (version history)
    │     ├── Control (linked to frameworks via links)
    │     ├── Task (evidence tasks with status)
    │     ├── Risk (likelihood/impact/treatment)
    │     ├── Vendor (name, category, risk assessment)
    │     ├── FrameworkInstance (selected frameworks)
    │     │     └── FrameworkVersion (pinned snapshot)
    │     ├── Context (Q&A pairs — AI knowledge base)
    │     ├── IntegrationConnection (OAuth/config storage)
    │     ├── Device (agent-reported compliance)
    │     └── Finding (typed findings across modules)
    │
    ├── FrameworkEditorFramework (template definitions)
    │     ├── FrameworkEditorPolicyTemplate (52 templates)
    │     ├── FrameworkEditorControlTemplate
    │     ├── FrameworkEditorTaskTemplate
    │     └── FrameworkEditorRequirement
    │
    └── IntegrationProvider (manifest-based)
          └── IntegrationConnection
                └── IntegrationCredentialVersion (encrypted)
```

### 5.2 Key Schema Files

| File | Models |
|------|--------|
| `packages/db/prisma/schema/auth.prisma` | User, Session, Account, Member, Invitation, OrganizationRole |
| `packages/db/prisma/schema/organization.prisma` | Organization |
| `packages/db/prisma/schema/policy.prisma` | Policy, PolicyVersion |
| `packages/db/prisma/schema/control.prisma` | Control |
| `packages/db/prisma/schema/framework.prisma` | FrameworkInstance, FrameworkVersion, all link tables |
| `packages/db/prisma/schema/task.prisma` | Task |
| `packages/db/prisma/schema/context.prisma` | Context |
| `packages/db/prisma/schema/framework-editor.prisma` | All FrameworkEditor* templates |
| `packages/db/prisma/schema/integration-platform.prisma` | Integration connections, credentials, runs, findings |
| `packages/db/prisma/schema/evidence-submission.prisma` | EvidenceSubmission |
| `packages/db/prisma/schema/device.prisma` | Device |
| `packages/db/prisma/schema/risk.prisma` | Risk |
| `packages/db/prisma/schema/vendor.prisma` | Vendor |

### 5.3 ID Convention

All IDs use prefixed CUIDs for type-safety and database indexing:

| Prefix | Table |
|--------|-------|
| `usr_` | User |
| `org_` | Organization |
| `mem_` | Member |
| `pol_` | Policy |
| `ctl_` | Control |
| `tsk_` | Task |
| `frm_` | FrameworkInstance |
| `ctx_` | Context |
| `dev_` | Device |
| `evs_` | EvidenceSubmission |

---

## 6. Policy Generation Pipeline

### 6.1 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      1. FRAMEWORK SELECTION                      │
│  User selects SOC 2, ISO 27001, HIPAA, GDPR from UI             │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              2. upsertOrgFrameworkStructure()                    │
│  File: apps/api/src/frameworks/frameworks-upsert.helper.ts      │
│                                                                  │
│  a. LoadFrameworkSources()                                       │
│     → Reads FrameworkVersion.manifest (frozen snapshot)          │
│     → Falls back to live FrameworkEditor* tables if no snapshot  │
│                                                                  │
│  b. Creates Policy rows from FrameworkEditorPolicyTemplate       │
│     → Template has: name, description, frequency, department,    │
│       content (TipTap JSON with {{placeholders}} + {{#if}}       │
│       conditional blocks)                                        │
│     → Creates initial PolicyVersion v1                           │
│                                                                  │
│  c. Creates Control rows from FrameworkEditorControlTemplate     │
│  d. Creates Task rows from FrameworkEditorTaskTemplate           │
│  e. Establishes link tables (policy↔control, control↔task, etc.) │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│             3. AI GENERATION (Trigger.dev Background)            │
│                                                                  │
│  Path A: BULK "Regenerate All Policies" (onboarding)             │
│  → apps/app/src/trigger/tasks/onboarding/generate-full-policies.ts
│  → Calls triggerPolicyUpdates()                                  │
│  → Batches trigger 'update-policy' for EVERY policy              │
│                                                                  │
│  Path B: INDIVIDUAL "Regenerate" button                          │
│  → POST /v1/policies/:id/regenerate                              │
│  → Triggers same 'update-policy' task for single policy          │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              4. processPolicyUpdate()                            │
│  File: apps/api/src/trigger/policies/update-policy-helpers.ts    │
│                                                                  │
│  Step 1: fetchOrganizationAndPolicy()                            │
│  → Loads org + policy + FrameworkEditorPolicyTemplate            │
│                                                                  │
│  Step 2: generatePolicyPrompt()                                  │
│  → Builds prompt with:                                           │
│    • Company name, website                                       │
│    • Selected frameworks (SOC 2, HIPAA, etc.)                    │
│    • Context Hub Q&A (knowledge base)                            │
│    • Template TipTap JSON with {{placeholders}}                  │
│    • Rules for evaluating {{#if soc2}} conditionals              │
│                                                                  │
│  Step 3: generatePolicyContent()                                 │
│  → Calls Groq API (llama-3.1-8b-instant)                        │
│  → response_format: { type: 'json_object' }                     │
│  → Returns TipTap document JSON                                  │
│                                                                  │
│  Step 4: updatePolicyInDatabase()                                │
│  → Deletes old S3 PDFs                                           │
│  → Transaction:                                                  │
│    • Clears currentVersionId, pendingVersionId                   │
│    • Deletes all old PolicyVersion records                       │
│    • Creates new PolicyVersion v1 with AI content                │
│    • Updates Policy.content + currentVersionId                   │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            5. AI CHAT IN POLICY EDITOR (Interactive)             │
│                                                                  │
│  POST /v1/policies/:id/ai-chat (SSE streaming)                  │
│  → Sends policy content + user message + context to Groq         │
│  → Streams response as text/event-stream to frontend             │
│                                                                  │
│  Frontend: PolicyAiAssistant component                           │
│  → Shows chat interface inside policy editor                     │
│  → AI returns markdown → useSuggestions hook                     │
│  → Converts to TipTap JSON                                       │
│  → Computes suggestion ranges (insert/delete/modify)             │
│  → Shows accept/reject buttons per change                       │
│                                                                  │
│  Tools available to AI chat:                                     │
│  • proposePolicy — propose changes                               │
│  • listVendors, getVendor — vendor lookup                        │
│  • listPolicies, getPolicy — policy reference                    │
│  • listEvidence — evidence check                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              6. VECTOR EMBEDDING (Semantic Search)               │
│                                                                  │
│  Triggers on policy publish: syncOrganizationEmbeddings()        │
│  → Extract plaintext from TipTap JSON                            │
│  → Chunk into 500-char segments (50 overlap)                    │
│  → Generate embedding (OpenAI text-embedding-3-small)           │
│  → Store in Upstash Vector                                       │
│                                                                  │
│  Sources synced:                                                 │
│  • Published policies                                            │
│  • Context Q&A entries                                           │
│  • Knowledge base documents                                      │
│  • Manual questionnaire answers                                  │
│                                                                  │
│  Used for:                                                       │
│  • Semantic search across policies                               │
│  • Auto-filling security questionnaires                          │
│  • Finding relevant policies for controls                        │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Policy Template Structure

Each `FrameworkEditorPolicyTemplate` contains TipTap JSON with:

```json
{
  "type": "document",
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "At {{COMPANY}}, we..." }] },
    { "type": "heading", "attrs": { "level": 1 }, "content": [...] }
  ]
}
```

**Placeholder variables:**
- `{{COMPANY}}`, `{{INDUSTRY}}`, `{{EMPLOYEES}}`
- `{{DATA}}`, `{{GEO}}`, `{{SOFTWARE}}`
- `{{CLOUD_PROVIDER}}`, `{{DEPLOYMENT_TYPE}}`

**Conditional blocks:**
- `{{#if soc2}}` Policy section for SOC 2 `{{/if}}`
- `{{#if hipaa}}` Policy section for HIPAA `{{/if}}`
- `{{#if gdpr}}` Policy section for GDPR `{{/if}}`

### 6.3 Why TipTap JSON (not Markdown)?

| Format | Pros | Cons |
|--------|------|------|
| **TipTap JSON** | Structured — version diffs, inline AI suggestions, conditional rendering, rich formatting | Heavier storage, complex to hand-edit |
| **Markdown** | Lightweight, human-readable | No structured diffs, poor for conditional rendering, limited formatting |

**Decision rationale:** The policy editor needs:
- **Version diffs** — compare current vs proposed changes structurally
- **Inline AI suggestions** — highlight specific sections proposed by AI with accept/reject
- **Conditional rendering** — show/hide sections per framework without losing content
- **Rich formatting** — headers, tables, lists beyond Markdown's capability

### 6.4 Why Groq (not OpenAI)?

- **Cost:** Groq's llama-3.1-8b-instant is significantly cheaper than GPT-4
- **Speed:** Fast inference, suitable for async background generation
- **Quality:** Sufficient for policy generation tasks (structured JSON output)
- **Trade-off:** Less capable than GPT-4 for complex reasoning, but policy generation is a straightforward fill-in-the-blanks task

### 6.5 Key Files — Policy Generation

| File | Purpose |
|------|---------|
| `apps/api/src/trigger/policies/update-policy.ts` | Trigger.dev task definition |
| `apps/api/src/trigger/policies/update-policy-helpers.ts` | Orchestration: fetch → prompt → generate → save |
| `apps/api/src/trigger/policies/update-policy-prompts.ts` | Prompt construction with context + template |
| `apps/api/src/frameworks/frameworks-upsert.helper.ts` | Initial policy creation from templates |
| `apps/api/src/frameworks/frameworks-source-loader.helper.ts` | Manifest/source loading |
| `apps/app/src/trigger/tasks/onboarding/generate-full-policies.ts` | Bulk generation trigger |
| `apps/app/src/trigger/tasks/onboarding/onboard-organization-helpers.ts` | Org onboarding orchestration |
| `apps/api/src/policies/policies.controller.ts` | REST endpoints (regenerate, AI chat, CRUD) |
| `apps/api/src/assistant-chat/assistant-chat.controller.ts` | Generalized AI chat endpoint |
| `apps/app/src/app/.../policies/[policyId]/editor/hooks/use-suggestions.ts` | Accept/reject suggestion system |

---

## 7. Integration Platform

### 7.1 Manifest Architecture

```
IntegrationManifest
├── id: string (e.g., "github", "aws")
├── name, description, category, logoUrl
├── auth: AuthStrategy
│   ├── oauth2 → authorizeUrl, tokenUrl, scopes, PKCE
│   ├── api_key → in: header|query, name, prefix
│   ├── basic → usernameField, passwordField
│   └── custom → credentialFields[] (typed form fields)
├── baseUrl, defaultHeaders
├── capabilities: ['checks', 'webhook', 'sync', 'device_sync']
├── services[] → sub-service definitions
├── variables[] → user-configurable check variables
├── checks[] → IntegrationCheck definitions
│   └── Each check has: id, name, description, taskMapping,
│       defaultSeverity, variables[], run(ctx) → pass/fail
└── isActive: boolean
```

### 7.2 Auth Strategies

| Type | Examples | Setup |
|------|----------|-------|
| **OAuth2** | GitHub, Google Workspace, GCP | Platform admin creates OAuth app → configures in admin UI → users connect |
| **API Key** | Vercel, DigitalOcean, Supabase | User provides API key directly |
| **Basic Auth** | Jenkins, Fivetran | Username + password |
| **Custom** | AWS (IAM Role), Azure (Service Principal) | Multi-field credential forms |

### 7.3 Existing Manifests (in code)

| Provider | Directory | Auth | Checks |
|----------|-----------|------|--------|
| **AWS** | `manifests/aws/` | Custom (IAM Role) | S3, IAM, EC2, RDS, KMS, CloudTrail |
| **Azure** | `manifests/azure/` | Custom (Service Principal) | Network, Storage, SQL, Key Vault, Monitor |
| **GCP** | `manifests/gcp/` | OAuth2 | IAM, VPC, Cloud SQL, Storage |
| **GitHub** | `manifests/github/` | OAuth2 | Branch protection, Dependabot, Code scanning, 2FA |
| **Google Workspace** | `manifests/google-workspace/` | OAuth2 | Employee access, 2FA |
| **Vercel** | `manifests/vercel/` | OAuth2 | App availability, Monitoring |
| **Rippling** | `manifests/rippling/` | OAuth2 | HR sync |
| **Aikido** | `manifests/aikido/` | API key | Code scanning, Issues |

Plus **583 integration metadata files** in `integrations-catalog/integrations/` — metadata-only (no check implementation yet for most).

### 7.4 Check Runtime

Each check executes via the **CheckRunner** which provides:

```typescript
interface CheckContext {
  accessToken: string;       // For OAuth
  credentials: Record<string, string>;  // For custom/basic/api_key auth
  variables: Record<string, unknown>;   // User-configured variables
  connectionId: string;
  organizationId: string;
  
  log(msg: string, meta?: object): void;
  warn(msg: string): void;
  pass(data: CheckResultData): void;        // Record pass with evidence
  fail(data: CheckResultFailData): void;     // Record failure with remediation
  fetch<T>(path: string, opts?: object): Promise<T>;  // Authenticated HTTP
  graphql<T>(query: string, vars?: object): Promise<T>;
  fetchAllPages<T>(path: string): Promise<T[]>;  // Auto-pagination
}
```

**Task mapping:** Checks can auto-complete compliance tasks when they pass:

```typescript
export const yourCheck: IntegrationCheck = {
  id: 'security-check',
  taskMapping: TASK_TEMPLATES.twoFactorAuth,  // Auto-completes "2FA" task
  run: async (ctx) => {
    // Check logic...
    ctx.pass({ title: '2FA Enabled', evidence: { ... } });
    // Task is automatically marked done
  },
};
```

### 7.5 Why Manifest-based Checks (not hardcoded)?

- **Extensible** — new integrations can be added without changing core platform code
- **Open to community** — contributors write manifests, not modify the platform
- **Dynamic loading** — manifests can be stored in DB for user-created integrations
- **Consistent interface** — every check follows the same pattern regardless of provider

---

## 8. Vector / Embedding Pipeline

### 8.1 Architecture

```
Policy Published / Context Updated / Document Uploaded
    │
    ▼
Trigger.dev Task (async)
    │
    ├── Extract plaintext from TipTap JSON / PDF / DOCX
    │   → extractTextFromPolicy() / extractContentFromFile()
    │
    ├── Chunk text into segments
    │   → chunkText(text, 500 chars, 50 overlap)
    │
    ├── Generate embeddings
    │   → OpenAI text-embedding-3-small
    │   → batchGenerateEmbeddings(chunks)
    │
    └── Upsert to Upstash Vector
        → batchUpsertEmbeddings(items)
        → Metadata: { organizationId, sourceType, sourceId,
           content (truncated), updatedAt }
```

### 8.2 Sync Sources

| Source | Trigger | Files |
|--------|---------|-------|
| **Published policies** | Policy publish/save | `sync-policies.ts` |
| **Context Q&A** | Context update | `sync-context.ts` |
| **Knowledge base docs** | Upload to S3 | `process-knowledge-base-document.ts` |
| **Manual questionnaire answers** | Answer save | `sync-manual-answer.ts` |

### 8.3 Semantic Search

```typescript
findSimilarContent(query: string, orgId: string, options?: {
  sourceTypes?: SourceType[];
  minScore?: number;    // default 0.1
  limit?: number;       // default 10
}): Promise<SimilarContent[]>
```

Used by:
- Security questionnaire auto-fill
- Policy search
- AI context retrieval

### 8.4 Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/vector-store/lib/core/client.ts` | Upstash Vector client |
| `apps/api/src/vector-store/lib/core/generate-embedding.ts` | OpenAI embedding calls |
| `apps/api/src/vector-store/lib/core/upsert-embedding.ts` | Batch upsert |
| `apps/api/src/vector-store/lib/core/query-helpers.ts` | Query execution |
| `apps/api/src/vector-store/lib/utils/chunk-text.ts` | Text chunking |
| `apps/api/src/vector-store/lib/utils/extract-policy-text.ts` | TipTap → plaintext |
| `apps/api/src/trigger/vector-store/process-knowledge-base-document.ts` | KB doc processing |

---

## 9. Context Hub

### 9.1 What It Is

The Context Hub (`Settings → Context Hub`) stores organization-specific Q&A pairs that feed ALL AI features:

```prisma
model Context {
  id              String   @id @default(...)
  organizationId  String
  question        String
  answer          String
  tags            String[]
}
```

### 9.2 Example Questions

| Question | Purpose |
|----------|---------|
| What industry is your company in? | Policy customization, risk assessment |
| How many employees do you have? | Scope determination |
| What software/tools do you use? | Vendor extraction, integration suggestions |
| Where do you host your application? | Infrastructure evidence, cloud checks |
| What type of data do you handle? | Data classification, policy content |
| Do you have a security team? | Role/RACI assignment |

### 9.3 How It Feeds AI

1. **Policy generation** — Context Q&A is serialized into the `contextHub` string and injected into every policy generation prompt
2. **AI Chat** — Context is included in the system prompt for the AI assistant
3. **Vendor extraction** — `extractVendorsFromContext()` uses AI to parse software answers into structured vendor records
4. **Questionnaire auto-fill** — Vector search across context + policies finds relevant answers for security questionnaires

### 9.4 Why Context Hub exists (instead of manual form fields)

- **AI-generated policies need business context** — without knowing the company's industry, size, stack, and data types, the AI generates generic boilerplate
- **Single source of truth** — fill once, used everywhere (policies, chat, questionnaires, vendor management)
- **Continuous improvement** — as context changes, regenerate policies with updated information

---

## 10. Evidence Collection

### 10.1 12 Evidence Form Types

| Form Type | Description |
|-----------|-------------|
| `board-meeting` | Board meeting minutes |
| `it-leadership-meeting` | IT leadership meeting records |
| `risk-committee-meeting` | Risk committee meeting records |
| `meeting` | General meeting records |
| `access-request` | Access request records |
| `whistleblower-report` | Whistleblower reports |
| `penetration-test` | Penetration test reports |
| `rbac-matrix` | Role-based access control matrix |
| `infrastructure-inventory` | Infrastructure inventory |
| `employee-performance-evaluation` | Employee evaluation records |
| `network-diagram` | Network architecture diagrams |
| `tabletop-exercise` | Tabletop exercise records |

### 10.2 Task-to-Control Mapping

```
FrameworkInstance
    → FrameworkControlTaskLink (maps control ↔ task)
    → FrameworkControlPolicyLink (maps control ↔ policy)
    → FrameworkControlDocumentTypeLink (maps control ↔ form type)
```

Each `Task` has:
- `status`: todo → in_progress → in_review → done | not_relevant | failed
- `automationStatus`: MANUAL (upload evidence) or AUTOMATED (connected integration)
- `assignee`, `approver`, `frequency`, `department`
- Linkable to controls, vendors, risks, evidence automations, findings

### 10.3 Evidence Submission Flow

```
User opens task → Sees required evidence form type
    │
    ▼
Uploads file / fills form
    │
    ▼
S3 presigned URL → Client PUTs file directly to S3
    │
    ▼
Submission created (EvidenceSubmission)
    │
    ▼
Reviewer approves/rejects
    │
    ▼
Task marked complete → Compliance score updates
```

### 10.4 Automated Evidence (Cloud Tests)

Integration checks auto-complete tasks when they pass:

```
Integration Run (scheduled or manual)
    → CheckRunner executes all checks for connected provider
    → Each check: IntegrationCheck.run(ctx)
    → pass/fail recorded in IntegrationCheckResult
    → If check.taskMapping matches task.taskTemplateId:
        → Task auto-marked as done (if passed)
```

---

## 11. Device Agent

### 11.1 Architecture

```
Package: packages/device-agent/
Tech: Electron + Vite + TypeScript
Build: electron-builder (macOS, Windows, Linux)
```

```
src/
├── main/              # Electron main process
│   ├── index.ts       # App lifecycle, tray, IPC
│   ├── auth.ts        # better-auth login flow
│   ├── device-info.ts # System info collection
│   ├── scheduler.ts   # Periodic check scheduler
│   ├── reporter.ts    # API communication
│   └── store.ts       # electron-store persistence
├── checks/            # Compliance checks per OS
│   ├── macos/         # disk-encryption, antivirus, password-policy, screen-lock
│   ├── windows/       # Same 4 checks via WMI/Registry
│   └── linux/         # Same 4 checks via shell commands
├── remediations/      # Auto-fix actions per OS
├── renderer/          # Status window UI (React)
└── shared/            # Types, constants
```

### 11.2 Compliance Checks

| Check | macOS | Windows | Linux |
|-------|-------|---------|-------|
| **Disk Encryption** | `fdesetup status` | BitLocker via WMI | `cryptsetup status` |
| **Antivirus** | `system_profiler SPSoftwareDataType` | Windows Defender via WMI | `clamav` / `chkrootkit` |
| **Password Policy** | `pwpolicy getaccountpolicies` | `net accounts` | `/etc/pam.d/` check |
| **Screen Lock** | `defaults read com.apple.screensaver` | Registry check | `gsettings` |

### 11.3 Remediation Strategies

| Strategy | Description |
|----------|-------------|
| `auto_fix` | Scripted fix (e.g., enable FileVault via CLI) |
| `admin_fix` | Requires admin password |
| `open_settings` | Opens system preferences to relevant pane |
| `guide_only` | Shows step-by-step instructions |

### 11.4 Communication Flow

```
Agent starts → better-auth login (opens browser)
    → Registers device per org → gets deviceId
    → Scheduler runs checks every N minutes
    → Reports results via POST /v1/device-agent/check-in
    → API updates Device.isCompliant + checkDetails
    → Tray icon shows compliant/non-compliant status
```

---

## 12. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         USERS                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   Admins  │  │Employees │  │ Auditors │  │ Device Agents   │  │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └────────┬─────────┘  │
└────────┼──────────────┼──────────────┼─────────────────┼──────────┘
         │              │              │                  │
         ▼              ▼              ▼                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                    LOAD BALANCER / DNS                             │
│         app.trycomp.ai    api.trycomp.ai    portal.trycomp.ai     │
└──────────────┬──────────────────┬───────────────────┬─────────────┘
               │                  │                    │
               ▼                  ▼                    ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────┐
│  Next.js App (:3000) │ │  NestJS API (:3333)  │ │ Next.js Portal │
│                      │ │                      │ │    (:3002)     │
│  • Dashboard UI      │ │  • Auth (better-auth) │ │                │
│  • Policy Editor     │ │  • RBAC (Permission)  │ │ • Employee     │
│  • AI Chat Frontend  │ │  • Business Logic     │ │   dashboard    │
│  • Evidence Upload   │ │  • Integration Checks │ │ • Policy view  │
│  • SWR Data Fetching │ │  • AI Generation      │ │ • Training     │
│  • Vector Sync       │ │  • File Uploads (S3)  │ │                │
└──────────────────────┘ └──────────┬───────────┘ └────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐   ┌──────────────────────┐   ┌────────────────────┐
│   PostgreSQL    │   │    Trigger.dev        │   │    AWS S3          │
│                 │   │  (Background Jobs)     │   │                    │
│  • All app data │   │                      │   │  • Evidence files   │
│  • User/Members │   │  • Policy Generation │   │  • Org assets       │
│  • Policies     │   │  • Doc Processing    │   │  • Questionnaire    │
│  • Integrations │   │  • Integration Runs  │   │    uploads          │
└─────────────────┘   └──────────────────────┘   └────────────────────┘
         │                      │
         │                      │
         ▼                      ▼
┌──────────────────┐   ┌──────────────────────┐
│  Upstash Redis   │   │  Upstash Vector      │
│                  │   │                      │
│  • KV store      │   │  • Policy embeddings │
│  • Rate limiting │   │  • Context embeddings │
│  • Chat history  │   │  • KB doc embeddings │
│  • Session cache │   │  • Semantic search   │
└──────────────────┘   └──────────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────┐
                        │   AI Providers        │
                        │                      │
                        │  • Groq (llama)       │
                        │  • OpenAI (embeddings)│
                        │  • Anthropic (backup) │
                        └──────────────────────┘

External Services:
┌──────────────────────────────────────────────────────────────────┐
│  Integration Platform → GitHub / AWS / GCP / Azure / 583+ APIs  │
│  Resend → Email delivery                                         │
│  Stripe → Billing / Subscriptions                                │
│  Google/GitHub/Microsoft → OAuth providers                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 13. Key Architectural Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| **NestJS for API** (not Next.js) | 50+ models, complex RBAC, DI, decorators, testing | Two apps to maintain vs one |
| **Session-based auth** (no JWT) | Cross-subdomain cookies, server-controlled, MCP OAuth | Requires cookie sync, no mobile |
| **TipTap JSON for policies** | Structured version diffs, AI suggestions, conditional rendering | Heavier storage, not human-readable |
| **OpenAI embeddings + Upstash Vector** | Simple, cheap, sufficient for scale | Less powerful than Pinecone/Weaviate |
| **Groq for AI generation** | Cheaper than GPT-4, fast enough for background | Less capable for complex reasoning |
| **Trigger.dev for background jobs** | Reliable queue, retries, concurrency control | SaaS dependency (or self-host) |
| **Context Hub as knowledge base** | Single source of truth feeds all AI features | Requires manual filling |
| **Manifest-based integrations** | Extensible, open to community, consistent interface | Maintenance overhead for 583 manifests |
| **AGPLv3 license** | Protects the open-core model, allows self-hosting | Copyleft — legal review needed for derivatives |
| **Electron for device agent** | Cross-platform, native system access | Heavy compared to CLI agent |

---

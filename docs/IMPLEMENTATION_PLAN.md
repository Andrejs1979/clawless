# Implementation Plan - All Sprints

**Project:** Clawless - Multi-Tenant Serverless AI Platform
**MVP Timeline:** 6 weeks
**Last Updated:** 2025-02-09

This document provides detailed task-level breakdowns for each sprint with specific files to create, dependencies, and acceptance criteria.

---

## Sprint 0: Foundation & Setup (Week 1)

**Status:** In Progress - Project structure complete, remaining: Cloudflare Workers setup

### Completed ✅
- [x] Planning documents (PRD, Architecture, Epics)
- [x] Project structure with TypeScript, ESLint, Prettier
- [x] D1 database schema (migrations/schema.sql)
- [x] Core types and utilities
- [x] Base worker scaffolding

### Remaining Tasks

#### T1: Configure Wrangler & Cloudflare Workers
**Priority:** P0 | **Estimate:** 2h

**Subtasks:**
- [ ] Install Wrangler CLI globally: `npm install -g wrangler`
- [ ] Authenticate: `wrangler login`
- [ ] Update `wrangler.toml` with real account ID
- [ ] Create D1 database: `wrangler d1 create clawless-db`
- [ ] Create KV namespace: `wrangler kv:namespace create CACHE`
- [ ] Create R2 bucket: `wrangler r2 bucket create clawless-storage`
- [ ] Update `wrangler.toml` with real IDs

**Files to modify:**
- `wrangler.toml`

**Acceptance:**
- `wrangler dev` starts local development server
- Can deploy to Cloudflare Workers

---

#### T2: Run Database Migrations
**Priority:** P0 | **Estimate:** 1h

**Subtasks:**
- [ ] Create local D1 database
- [ ] Run migrations: `wrangler d1 execute clawless-db --local --file=./migrations/schema.sql`
- [ ] Verify tables created: `wrangler d1 execute clawless-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"`
- [ ] Create migration script for production

**Files to create:**
- `scripts/migrate.sh` - Migration wrapper script
- `scripts/migrate-remote.sh` - Production migration script

**Acceptance:**
- All 10 tables created locally
- Can query D1 successfully

---

#### T3: Create Database Query Layer
**Priority:** P0 | **Estimate:** 2h

**Subtasks:**
- [ ] Create base DB client wrapper
- [ ] Implement tenant queries (create, get, update)
- [ ] Implement API key queries (create, get by hash)
- [ ] Implement session queries (create, get, list, delete)
- [ ] Implement message queries (create, get by session)

**Files to create:**
- `src/db/client.ts` - D1 client wrapper
- `src/db/tenants.ts` - Tenant queries
- `src/db/api-keys.ts` - API key queries
- `src/db/sessions.ts` - Session queries
- `src/db/messages.ts` - Message queries

**Acceptance:**
- All CRUD operations defined
- Type-safe query results

---

#### T4: Add Git Hooks & CI/CD
**Priority:** P1 | **Estimate:** 1h

**Subtasks:**
- [ ] Install husky: `npm install -D husky`
- [ ] Install lint-staged: `npm install -D lint-staged`
- [ ] Configure pre-commit hook
- [ ] Update GitHub Actions workflow

**Files to create:**
- `.husky/pre-commit`
- `lint-staged.config.js`

**Files to modify:**
- `.github/workflows/ci.yml`
- `package.json`

**Acceptance:**
- Pre-commit hook runs lint and format
- CI pipeline passes on push

---

### Sprint 0 DoD
- [ ] All tests passing
- [ ] Can deploy "Hello World" to Workers
- [ ] D1 migrations run successfully
- [ ] CI/CD pipeline working

---

## Sprint 1: Core Runtime (Week 2)

**Goal:** Build AI assistant runtime with LLM integration and session management

### T1: LLM Client Interface
**Priority:** P0 | **Estimate:** 4h | **Day 1**

**Subtasks:**
- [ ] Define `LLMClient` interface
- [ ] Implement Workers AI client
  - Text generation with Llama 3.1 8B
  - Streaming support
  - Error handling
- [ ] Implement Anthropic client (Haiku, Sonnet)
- [ ] Create client factory
- [ ] Add retry logic with exponential backoff

**Files to create:**
- `src/llm/base.ts` - LLMClient interface
- `src/llm/workers-ai.ts` - Workers AI implementation
- `src/llm/anthropic.ts` - Anthropic implementation
- `src/llm/factory.ts` - Client factory
- `src/llm/types.ts` - LLM-specific types

**Acceptance:**
- Can generate text with Workers AI
- Streaming works
- Retry logic handles failures

---

### T2: Smart Model Routing
**Priority:** P0 | **Estimate:** 3h | **Day 2**

**Subtasks:**
- [ ] Implement query complexity classifier
- [ ] Create model selection logic
- [ ] Add tenant tier consideration
- [ ] Support user model override
- [ ] Implement fallback chain

**Files to create:**
- `src/llm/router.ts` - Model routing logic
- `src/llm/classifier.ts` - Query classification
- `src/llm/fallback.ts` - Fallback chain

**Acceptance:**
- Simple queries use Llama 8B
- Complex queries use Llama 70B
- Enterprise tier can override to Claude
- Fallback works on errors

---

### T3: Session Management
**Priority:** P0 | **Estimate:** 4h | **Day 3**

**Subtasks:**
- [ ] Create SessionManager class
- [ ] Implement KV caching layer (5min TTL)
- [ ] Add session CRUD operations
- [ ] Implement message history with pagination
- [ ] Add session reset functionality
- [ ] Handle context window limits

**Files to create:**
- `src/sessions/manager.ts` - Session management
- `src/sessions/cache.ts` - KV caching layer
- `src/sessions/context.ts` - Context window management

**Acceptance:**
- Can create/load/update/delete sessions
- Sessions cache in KV
- Message history paginates correctly
- Reset clears context

---

### T4: Streaming Responses
**Priority:** P0 | **Estimate:** 3h | **Day 4**

**Subtasks:**
- [ ] Create SSE stream transformer
- [ ] Handle connection drops gracefully
- [ ] Support CORS for streaming
- [ ] Implement response accumulator
- [ ] Add thinking level support (Claude)
- [ ] Handle mid-stream errors

**Files to create:**
- `src/streaming/sse.ts` - SSE formatting
- `src/streaming/accumulator.ts` - Response accumulation
- `src/streaming/handler.ts` - Stream orchestration

**Acceptance:**
- SSE streaming works end-to-end
- Connection drops handled
- Accumulator stores full response

---

### T5: Tool Execution Framework
**Priority:** P1 | **Estimate:** 3h | **Day 5**

**Subtasks:**
- [ ] Define Tool interface
- [ ] Create tool registry
- [ ] Implement permission checks
- [ ] Add execution logging
- [ ] Implement built-in tools:
  - `sessions_list` - List active sessions
  - `sessions_send` - Send to another session

**Files to create:**
- `src/tools/registry.ts` - Tool registry
- `src/tools/executor.ts` - Tool execution
- `src/tools/permissions.ts` - Permission checks
- `src/tools/builtins/sessions.ts` - Session tools

**Acceptance:**
- Tool registry functional
- Permissions enforced
- Built-in tools work
- Execution logged

---

### Sprint 1 DoD
- [ ] Can create session and send message
- [ ] Workers AI generates responses
- [ ] Streaming works
- [ ] Sessions persist in D1
- [ ] Tools execute (basic)

---

## Sprint 2: Tenant Management (Week 3)

**Goal:** Multi-tenancy with isolation, authentication, and quotas

### T1: Tenant CRUD Operations
**Priority:** P0 | **Estimate:** 3h | **Day 1**

**Subtasks:**
- [ ] Implement TenantManager class
- [ ] Add tenant creation with defaults
- [ ] Add tenant read/update/delete
- [ ] Implement status management (active/suspended)
- [ ] Add tenant configuration:
  - Default model
  - System prompt
  - Tool permissions

**Files to create:**
- `src/tenants/manager.ts` - Tenant management
- `src/tenants/config.ts` - Tenant configuration
- `src/tenants/validation.ts` - Tenant validation

**Acceptance:**
- Can CRUD tenants
- Defaults applied on creation
- Status changes work
- Configuration persists

---

### T2: API Key Management
**Priority:** P0 | **Estimate:** 3h | **Day 2**

**Subtasks:**
- [ ] Implement secure key generation
- [ ] Add SHA-256 hashing
- [ ] Create key validation middleware
- [ ] Add key rotation support
- [ ] Handle key expiration
- [ ] Implement scope/permission system

**Files to create:**
- `src/auth/keys.ts` - API key management
- `src/auth/middleware.ts` - Auth middleware
- `src/auth/scopes.ts` - Permission scopes

**Acceptance:**
- Keys generate securely
- Hashing works
- Middleware validates requests
- Rotation supported

---

### T3: Usage Quotas
**Priority:** P0 | **Estimate:** 3h | **Day 3**

**Subtasks:**
- [ ] Implement QuotaManager class
- [ ] Add quota configuration per tier
- [ ] Create quota checking middleware
- [ ] Track usage per tenant
- [ ] Handle overages (block + 429)
- [ ] Implement monthly reset

**Files to create:**
- `src/quotas/manager.ts` - Quota management
- `src/quotas/middleware.ts` - Quota checking
- `src/quotas/tracker.ts` - Usage tracking

**Acceptance:**
- Quotas enforce limits
- Tracking accurate
- Overages return 429
- Reset works monthly

---

### T4: Tenant Isolation
**Priority:** P0 | **Estimate:** 2h | **Day 4**

**Subtasks:**
- [ ] Implement row-level security pattern
- [ ] Add tenant context propagation
- [ ] Validate tenant on every request
- [ ] Prevent cross-tenant access
- [ ] Add isolation tests

**Files to create:**
- `src/auth/context.ts` - Tenant context
- `src/auth/isolation.ts` - Isolation checks
- `tests/isolation.test.ts` - Isolation tests

**Acceptance:**
- All queries filter by tenant_id
- Context propagates correctly
- Cross-tenant requests blocked
- Tests pass

---

### T5: Admin APIs
**Priority:** P1 | **Estimate:** 3h | **Day 5**

**Subtasks:**
- [ ] Create admin endpoints:
  - `POST /admin/tenants`
  - `GET /admin/tenants/:id`
  - `PUT /admin/tenants/:id`
  - `GET /admin/tenants/:id/usage`
- [ ] Implement admin authentication
- [ ] Add admin rate limiting
- [ ] Create admin tests

**Files to create:**
- `src/workers/admin.ts` - Admin worker
- `src/admin/handlers.ts` - Admin handlers
- `src/admin/auth.ts` - Admin authentication

**Acceptance:**
- Admin can manage tenants
- Admin auth works
- Rate limited
- Tests pass

---

### Sprint 2 DoD
- [ ] Can CRUD tenants
- [ ] API key auth working
- [ ] Quotas enforced
- [ ] Data isolated
- [ ] Admin APIs functional

---

## Sprint 3: API Channel (Week 4)

**Goal:** REST API with authentication, rate limiting, and error handling

### T1: API Gateway Routing
**Priority:** P0 | **Estimate:** 2h | **Day 1**

**Subtasks:**
- [ ] Implement request router
- [ ] Add route handlers:
  - `POST /v1/chat/completions`
  - `GET/POST /v1/sessions`
  - `GET/DELETE /v1/sessions/:id`
- [ ] Add request validation (Zod)
- [ ] Implement CORS
- [ ] Add response formatting

**Files to create:**
- `src/api/router.ts` - Request router
- `src/api/schemas.ts` - Validation schemas
- `src/api/cors.ts` - CORS handling

**Acceptance:**
- All routes defined
- Validation works
- CORS configured

---

### T2: Chat Completions Endpoint
**Priority:** P0 | **Estimate:** 4h | **Day 2**

**Subtasks:**
- [ ] Implement `POST /v1/chat/completions`
- [ ] Support streaming and non-streaming
- [ ] Add message validation
- [ ] Implement model selection
- [ ] Handle errors gracefully
- [ ] Add tests

**Files to create:**
- `src/api/chat.ts` - Chat completions handler
- `tests/api/chat.test.ts` - Chat tests

**Acceptance:**
- Endpoint works
- Streaming functional
- Errors handled

---

### T3: Session Endpoints
**Priority:** P0 | **Estimate:** 3h | **Day 3**

**Subtasks:**
- [ ] `GET /v1/sessions` - List with pagination
- [ ] `POST /v1/sessions` - Create session
- [ ] `GET /v1/sessions/:id` - Get details
- [ ] `DELETE /v1/sessions/:id` - Delete
- [ ] `POST /v1/sessions/:id/reset` - Reset context
- [ ] Add tests

**Files to create:**
- `src/api/sessions.ts` - Session handlers
- `tests/api/sessions.test.ts` - Session tests

**Acceptance:**
- All endpoints working
- Pagination functional
- Tests pass

---

### T4: Error Handling System
**Priority:** P0 | **Estimate:** 2h | **Day 4**

**Subtasks:**
- [ ] Standardize error responses
- [ ] Add error logging
- [ ] Implement request ID correlation
- [ ] Create error documentation
- [ ] Add OpenAPI spec

**Files to create:**
- `src/errors/handler.ts` - Error handler
- `src/errors/types.ts` - Error types
- `docs/openapi.yaml` - OpenAPI spec

**Acceptance:**
- Errors consistent
- Logging works
- API documented

---

### T5: API Documentation
**Priority:** P1 | **Estimate:** 2h | **Day 5**

**Subtasks:**
- [ ] Complete OpenAPI spec
- [ ] Add request/response examples
- [ ] Create API reference docs
- [ ] Add integration examples
- [ ] Document error codes

**Files to create:**
- `docs/api-reference.md`
- `docs/api-examples.md`
- `docs/error-codes.md`

**Acceptance:**
- OpenAPI spec complete
- Examples work
- Docs comprehensive

---

### Sprint 3 DoD
- [ ] All REST endpoints working
- [ ] Authentication functional
- [ ] Rate limiting active
- [ ] Errors consistent
- [ ] API documented

---

## Sprint 4: WebChat Widget (Week 5)

**Goal:** Embeddable chat widget for tenant websites

### T1: Widget Architecture
**Priority:** P0 | **Estimate:** 3h | **Day 1**

**Subtasks:**
- [ ] Design widget architecture
- [ ] Set up build system (esbuild)
- [ ] Create widget skeleton
- [ ] Implement Shadow DOM isolation
- [ ] Design configuration API

**Files to create:**
- `widget/src/index.ts` - Widget entry
- `widget/src/container.ts` - Shadow DOM container
- `widget/src/config.ts` - Configuration
- `widget/esbuild.config.js` - Build config

**Acceptance:**
- Widget builds
- Shadow DOM works
- Configuration API defined

---

### T2: Chat UI Components
**Priority:** P0 | **Estimate:** 4h | **Day 2**

**Subtasks:**
- [ ] Create message list component
- [ ] Create message input (auto-resize)
- [ ] Add send button
- [ ] Implement loading indicator
- [ ] Add streaming display
- [ ] Make mobile responsive

**Files to create:**
- `widget/src/components/MessageList.ts`
- `widget/src/components/MessageInput.ts`
- `widget/src/components/LoadingIndicator.ts`
- `widget/src/styles/main.css`

**Acceptance:**
- UI components render
- Responsive design works
- Streaming displays correctly

---

### T3: API Integration
**Priority:** P0 | **Estimate:** 3h | **Day 3**

**Subtasks:**
- [ ] Create API client
- [ ] Handle API key configuration
- [ ] Implement SSE streaming
- [ ] Add error handling
- [ ] Implement connection management
- [ ] Add message queuing

**Files to create:**
- `widget/src/api/client.ts`
- `widget/src/api/streaming.ts`
- `widget/src/api/queue.ts`

**Acceptance:**
- Connects to REST API
- Streaming works
- Errors handled

---

### T4: Customization & Theming
**Priority:** P1 | **Estimate:** 2h | **Day 4**

**Subtasks:**
- [ ] Implement color customization
- [ ] Add position options
- [ ] Create theme presets
- [ ] Support custom CSS
- [ ] Add logo/icon upload

**Files to create:**
- `widget/src/themes/presets.ts`
- `widget/src/themes/customizer.ts`

**Acceptance:**
- Colors customizable
- Position configurable
- Themes apply correctly

---

### T5: Deployment & Integration
**Priority:** P0 | **Estimate:** 2h | **Day 5**

**Subtasks:**
- [ ] Create widget serving Worker
- [ ] Implement CDN deployment
- [ ] Add versioning
- [ ] Write integration guide
- [ ] Create demo page
- [ ] Add widget tests

**Files to create:**
- `src/workers/widget-serve.ts`
- `docs/widget-integration.md`
- `demo/index.html`

**Acceptance:**
- Widget deployed to CDN
- Integration guide complete
- Demo works

---

### Sprint 4 DoD
- [ ] Widget embeddable via script
- [ ] Chat UI functional
- [ ] Streaming works
- [ ] Customizable styling
- [ ] Integration guide complete

---

## Sprint 5: Polish & Launch (Week 6)

**Goal:** Testing, monitoring, documentation, and deployment

### T1: Testing Suite
**Priority:** P0 | **Estimate:** 4h | **Day 1**

**Subtasks:**
- [ ] Write end-to-end tests
- [ ] Add integration tests
- [ ] Implement load tests
- [ ] Run security audit
- [ ] Fix bugs
- [ ] Optimize performance

**Files to create:**
- `tests/e2e/flows.test.ts`
- `tests/load/stress.test.ts`
- `tests/security/isolation.test.ts`

**Acceptance:**
- E2E tests pass
- Load tests complete
- Security audit passed

---

### T2: Observability
**Priority:** P0 | **Estimate:** 3h | **Day 2**

**Subtasks:**
- [ ] Implement request logging
- [ ] Add correlation IDs
- [ ] Create metrics dashboard
- [ ] Set up error tracking
- [ ] Configure Cloudflare Analytics

**Files to create:**
- `src/observability/logger.ts`
- `src/observability/metrics.ts`
- `src/observability/tracing.ts`

**Acceptance:**
- All requests logged
- Metrics collected
- Errors tracked

---

### T3: Documentation
**Priority:** P0 | **Estimate:** 3h | **Day 3**

**Subtasks:**
- [ ] Complete README
- [ ] Finish API docs
- [ ] Write deployment guide
- [ ] Add troubleshooting
- [ ] Create architecture diagrams
- [ ] Write contributing guide

**Files to create:**
- `README.md` (update)
- `docs/deployment.md`
- `docs/troubleshooting.md`
- `docs/contributing.md`

**Acceptance:**
- All docs complete
- Examples work
- Diagrams clear

---

### T4: Production Deployment
**Priority:** P0 | **Estimate:** 3h | **Day 4**

**Subtasks:**
- [ ] Create production D1 database
- [ ] Set up production KV
- [ ] Deploy to production Workers
- [ ] Configure custom domain
- [ ] Set up environment secrets
- [ ] Write deployment runbook

**Files to create:**
- `scripts/deploy-production.sh`
- `docs/runbook.md`

**Acceptance:**
- Production deployed
- Custom domain active
- Secrets configured

---

### T5: Launch Preparation
**Priority:** P0 | **Estimate:** 2h | **Day 5**

**Subtasks:**
- [ ] Complete pre-launch checklist
- [ ] Run smoke tests
- [ ] Document rollback plan
- [ ] Onboard beta tenant
- [ ] Set up monitoring
- [ ] Prepare launch announcement

**Files to create:**
- `docs/checklist.md`
- `docs/rollback.md`

**Acceptance:**
- Checklist complete
- Smoke tests pass
- Beta tenant active
- Monitoring configured

---

### Sprint 5 DoD
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Deployed to production
- [ ] Monitoring active
- [ ] Beta tenant using platform

---

## Post-MVP Roadmap

### Phase 2: Features (Weeks 7-10)
- Webhook notifications
- Tool marketplace
- Admin dashboard UI
- Custom domains

### Phase 3: Scale (Weeks 11-14)
- Multi-region deployment
- Caching optimization
- Database sharding
- Advanced monitoring

### Phase 4: Ecosystem (Weeks 15+)
- Channel connectors (Slack, Discord)
- Voice support (Twilio)
- RAG capabilities
- Multi-agent workflows

---

## Dependencies & Blockers

### External Dependencies
- Cloudflare Workers account
- Cloudflare D1 available
- Anthropic API key (optional)
- OpenAI API key (optional)
- Custom domain

### Technical Dependencies
| Task | Depends On |
|------|------------|
| Sprint 1: LLM Client | Sprint 0: Wrangler setup |
| Sprint 1: Streaming | Sprint 1: LLM Client |
| Sprint 2: Tenant Management | Sprint 1: Session Management |
| Sprint 3: API Channel | Sprint 2: Tenant Management |
| Sprint 4: WebChat Widget | Sprint 3: API Channel |
| Sprint 5: Launch | All previous sprints |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Workers AI quality issues | High | Hybrid routing to Anthropic |
| D1 performance issues | Medium | KV caching layer |
| Multi-tenant data leakage | Critical | Extensive testing |
| Slow time-to-first-token | High | KV cache + warm routing |
| Deployment complexity | Medium | Comprehensive docs |

---

## Success Metrics

### Sprint Velocity
- Target: 5-8 story points per sprint
- Measure: Completed tasks vs. planned

### Quality Metrics
- Test coverage: >70%
- Bug count: <5 per sprint
- API success rate: >99%

### Product Metrics
- Active tenants: 1+ by Sprint 5
- Messages processed: 100+ by Sprint 5
- p95 latency: <1s
- Cost per 1K messages: <$0.20

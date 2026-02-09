# Sprint Plans

**Project:** Clawless - Multi-Tenant Serverless AI Platform
**MVP Timeline:** 6 weeks
**Last Updated:** 2025-02-09

---

## Sprint Overview

| Sprint       | Duration | Focus              | Deliverables                            |
| ------------ | -------- | ------------------ | --------------------------------------- |
| **Sprint 0** | Week 1   | Foundation & Setup | Project structure, tooling, database    |
| **Sprint 1** | Week 2   | Core Runtime       | LLM integration, sessions, streaming    |
| **Sprint 2** | Week 3   | Tenant Management  | Multi-tenancy, API keys, quotas         |
| **Sprint 3** | Week 4   | API Channel        | REST API, authentication, rate limiting |
| **Sprint 4** | Week 5   | WebChat Widget     | Embeddable UI, WebSocket/SSE            |
| **Sprint 5** | Week 6   | Polish & Launch    | Testing, docs, deployment, monitoring   |

---

## Sprint 0: Foundation & Setup

**Duration:** Week 1 (5 days)
**Status:** In Progress
**Goal:** Set up development environment and core infrastructure

### Days 1-2: Project Structure & Tooling

**Tasks:**

- [x] Create planning documents (PRD, Architecture, Epics)
- [x] Finalize architecture decisions
- [ ] Initialize TypeScript project
- [ ] Configure ESLint, Prettier, TypeScript strict mode
- [ ] Set up package.json with scripts
- [ ] Create folder structure:
  ```
  src/
  ├── core/           # Core runtime, LLM clients
  ├── workers/        # Cloudflare Workers
  ├── db/             # Database queries, migrations
  ├── types/          # TypeScript types
  └── utils/          # Utilities
  tests/
  docs/
  wrangler/
  ```

**Deliverables:**

- Monorepo with TypeScript config
- ESLint + Prettier configured
- Git hooks (husky + lint-staged)
- Basic README

### Days 3-4: Cloudflare Workers & D1 Setup

**Tasks:**

- [ ] Install and configure Wrangler CLI
- [ ] Create Cloudflare Workers project
- [ ] Set up D1 database (local + remote)
- [ ] Create database migration system
- [ ] Write initial D1 schema migrations:
  - `001_tenants.sql`
  - `002_api_keys.sql`
  - `003_sessions.sql`
  - `004_messages.sql`
  - `005_tool_executions.sql`
- [ ] Configure KV namespace bindings
- [ ] Set up environment variables (local dev)
- [ ] Create base Wrangler config

**Deliverables:**

- Working Wrangler setup
- D1 database with migrations
- Local development environment
- KV namespace configured

### Day 5: Core Types & Utilities

**Tasks:**

- [ ] Define core TypeScript types:
  - `Tenant`, `ApiKey`, `Session`, `Message`
  - `LLMProvider`, `LLMRequest`, `LLMResponse`
  - `Tool`, `ToolCall`, `ToolExecution`
  - `ChatCompletionRequest`, `ChatCompletionResponse`
- [ ] Create utility functions:
  - ID generation (nanoid/cuid)
  - Timestamp helpers
  - Error types
  - Logging utilities
- [ ] Set up Vitest for testing
- [ ] Write first test (placeholder)

**Deliverables:**

- Core type definitions
- Utility library
- Test framework configured

### Sprint 0 Definition of Done

- [x] All planning documents complete
- [ ] Project builds locally
- [ ] Tests can run
- [ ] D1 migrations can execute
- [ ] Can deploy a "Hello World" Worker

---

## Sprint 1: Core Runtime

**Duration:** Week 2 (5 days)
**Goal:** Build AI assistant runtime with LLM integration and session management

### Day 1: LLM Client Interface

**Tasks:**

- [ ] Design `LLMClient` interface
- [ ] Implement Workers AI client
  - Text generation via `@cf/meta/llama-3.1-8b-instruct-fp8-fast`
  - Streaming support
  - Error handling
- [ ] Implement Anthropic client (optional/fallback)
  - Claude API integration
  - Streaming support
  - Error handling & retry logic
- [ ] Create client factory pattern
- [ ] Write tests for LLM clients

**Deliverables:**

- `LLMClient` interface
- Workers AI implementation
- Anthropic implementation (stub/optional)
- Client factory

### Day 2: Smart Model Routing

**Tasks:**

- [ ] Implement query classifier
  - Simple vs complex detection
  - Code detection
  - Vision detection
- [ ] Create routing logic based on:
  - Query complexity
  - Tenant tier
  - User override
- [ ] Add model fallback chain
- [ ] Test routing decisions

**Deliverables:**

- `selectModel()` function
- Routing tests
- Fallback logic

### Day 3: Session Management

**Tasks:**

- [ ] Implement session CRUD
  - Create session with context
  - Load session with history
  - Update session metadata
  - Delete session
- [ ] Implement KV caching layer
  - Cache hot sessions (5min TTL)
  - Cache invalidation on updates
  - Write-through to D1
- [ ] Message history pagination
- [ ] Session reset functionality

**Deliverables:**

- `SessionManager` class
- KV + D1 hybrid storage
- Session tests

### Day 4: Streaming Responses

**Tasks:**

- [ ] Implement SSE streaming
  - Transform LLM chunks to SSE format
  - Handle connection drops
  - Support CORS
- [ ] Create streaming orchestrator
  - Manage LLM connection
  - Accumulate response for storage
  - Error handling mid-stream
- [ ] Add thinking level support (Claude extended thinking)
- [ ] Stream tests

**Deliverables:**

- SSE streaming implementation
- Response accumulator
- Stream tests

### Day 5: Tool Execution Framework

**Tasks:**

- [ ] Design tool execution interface
- [ ] Implement built-in tools:
  - `sessions_list` - List active sessions
  - `sessions_send` - Send to another session
- [ ] Tool permission checks
- [ ] Tool execution logging
- [ ] Create tool registry

**Deliverables:**

- Tool framework
- 2 built-in tools
- Tool permission checks
- Tool tests

### Sprint 1 Definition of Done

- [ ] Can create session
- [ ] Can send message and receive streaming response
- [ ] Workers AI integration working
- [ ] Sessions persist in D1
- [ ] Tools can execute (basic)
- [ ] All tests passing

---

## Sprint 2: Tenant Management

**Duration:** Week 3 (5 days)
**Goal:** Multi-tenancy with isolation, authentication, and per-tenant configuration

### Day 1: Tenant CRUD

**Tasks:**

- [ ] Implement tenant creation API
  - Generate unique tenant ID
  - Apply default settings
  - Store in D1
- [ ] Tenant read/update/delete
- [ ] Tenant status management (active/suspended)
- [ ] Tenant configuration:
  - Default model selection
  - System prompt template
  - Tool permissions
- [ ] Tenant tests

**Deliverables:**

- `TenantManager` class
- Tenant CRUD endpoints (internal)
- Tenant tests

### Day 2: API Key Management

**Tasks:**

- [ ] API key generation (secure random)
- [ ] API key hashing (SHA-256)
- [ ] API key validation middleware
- [ ] Key rotation support
- [ ] Key expiration handling
- [ ] Scope/permission system
- [ ] API key tests

**Deliverables:**

- `ApiKeyManager` class
- Auth middleware
- API key tests

### Day 3: Usage Quotas

**Tasks:**

- [ ] Quota configuration per tenant
  - Messages per month
  - Tokens per month
- [ ] Quota checking middleware
- [ ] Usage tracking (per tenant)
- [ ] Overage handling:
  - Block when exceeded
  - Return 429 with info
  - Log overage events
- [ ] Quota reset logic (monthly)
- [ ] Quota tests

**Deliverables:**

- `QuotaManager` class
- Quota middleware
- Usage tracking
- Quota tests

### Day 4: Tenant Isolation

**Tasks:**

- [ ] Row-level security implementation
  - All queries filter by tenant_id
  - Validate tenant context on every request
- [ ] Tenant context propagation
- [ ] Cross-tenant request prevention
- [ ] Data isolation tests
- [ ] Security audit

**Deliverables:**

- Tenant context system
- Row-level security
- Isolation tests
- Security documentation

### Day 5: Admin APIs

**Tasks:**

- [ ] Create admin API endpoints:
  - `POST /admin/tenants` - Create tenant
  - `GET /admin/tenants/:id` - Get tenant
  - `PUT /admin/tenants/:id` - Update tenant
  - `GET /admin/tenants/:id/usage` - Usage stats
- [ ] Admin authentication (separate from tenant auth)
- [ ] Admin rate limiting
- [ ] Admin API tests

**Deliverables:**

- Admin API endpoints
- Admin auth
- Admin tests

### Sprint 2 Definition of Done

- [ ] Can create/manage tenants
- [ ] API key authentication working
- [ ] Quotas enforced
- [ ] Tenant data isolated
- [ ] Admin can manage tenants
- [ ] All tests passing

---

## Sprint 3: API Channel

**Duration:** Week 4 (5 days)
**Goal:** REST API with authentication, rate limiting, and error handling

### Day 1: API Gateway Worker

**Tasks:**

- [ ] Create API Gateway Worker
- [ ] Request routing:
  - `POST /v1/chat/completions`
  - `GET /v1/sessions`
  - `POST /v1/sessions`
  - `GET /v1/sessions/:id`
  - `DELETE /v1/sessions/:id`
- [ ] Request validation (Zod schemas)
- [ ] Response formatting
- [ ] CORS handling
- [ ] Gateway tests

**Deliverables:**

- API Gateway Worker
- Route handlers
- Validation schemas
- Gateway tests

### Day 2: Authentication & Authorization

**Tasks:**

- [ ] Bearer token middleware
- [ ] API key validation
- [ ] Tenant context loading
- [ ] Permission checking
- [ ] Rate limiting per tenant:
  - Token bucket algorithm
  - Per-endpoint limits
  - Burst allowance
- [ ] Auth tests

**Deliverables:**

- Auth middleware
- Rate limiter
- Auth tests

### Day 3: Chat Completions Endpoint

**Tasks:**

- [ ] Implement `POST /v1/chat/completions`
- [ ] Support both streaming and non-streaming
- [ ] Message format validation
- [ ] Model selection (routing + override)
- [ ] Error responses
- [ ] Chat tests

**Deliverables:**

- Chat completions endpoint
- Streaming support
- Chat tests

### Day 4: Session Endpoints

**Tasks:**

- [ ] `GET /v1/sessions` - List sessions (paginated)
- [ ] `POST /v1/sessions` - Create session
- [ ] `GET /v1/sessions/:id` - Get session details
- [ ] `DELETE /v1/sessions/:id` - Delete session
- [ ] `POST /v1/sessions/:id/reset` - Reset context
- [ ] Session tests

**Deliverables:**

- Session endpoints
- Pagination
- Session tests

### Day 5: Error Handling & Documentation

**Tasks:**

- [ ] Standardized error responses
  - ValidationError (400)
  - AuthenticationError (401)
  - RateLimitError (429)
  - NotFoundError (404)
  - InternalError (500)
- [ ] Error logging
- [ ] Request ID correlation
- [ ] OpenAPI/Swagger documentation
- [ ] API examples

**Deliverables:**

- Error handling system
- Error documentation
- OpenAPI spec
- API examples

### Sprint 3 Definition of Done

- [ ] All REST endpoints working
- [ ] Authentication working
- [ ] Rate limiting active
- [ ] Error handling consistent
- [ ] API documented
- [ ] All tests passing

---

## Sprint 4: WebChat Widget

**Duration:** Week 5 (5 days)
**Goal:** Embeddable chat widget for tenant websites

### Day 1: Widget Architecture

**Tasks:**

- [ ] Design widget architecture
  - Vanilla JS (no framework dependencies)
  - Embed via `<script>` tag
  - Shadow DOM for isolation
- [ ] Create widget build system
- [ ] Design widget API
- [ ] Styling system (CSS variables for theming)
- [ ] Widget skeleton

**Deliverables:**

- Widget project structure
- Build system
- Widget skeleton
- Design mockups

### Day 2: Chat Interface

**Tasks:**

- [ ] Chat UI components:
  - Message list (user + assistant)
  - Message input (textarea, auto-resize)
  - Send button
  - Loading indicator
  - Streaming response display
- [ ] Session persistence (localStorage)
- [ ] Mobile responsive design
- [ ] Accessibility (ARIA labels, keyboard nav)

**Deliverables:**

- Chat UI
- Message components
- Responsive styles

### Day 3: API Integration

**Tasks:**

- [ ] Connect to REST API
- [ ] Handle API keys (tenant provides)
- [ ] Implement streaming (SSE)
- [ ] Error handling and retry
- [ ] Connection management
- [ ] Message queuing (offline support)

**Deliverables:**

- API client in widget
- Streaming support
- Error handling

### Day 4: Customization & Branding

**Tasks:**

- [ ] Widget configuration:
  - Colors (primary, background, text)
  - Position (bottom-right, bottom-left)
  - Size (expanded, collapsed)
  - Welcome message
  - Placeholder text
- [ ] Theme presets
- [ ] Custom CSS support
- [ ] Logo/icon upload

**Deliverables:**

- Configuration system
- Theme options
- Branding docs

### Day 5: Deployment & Integration

**Tasks:**

- [ ] Create widget serving Worker
- [ ] CDN deployment
- [ ] Versioning strategy
- [ ] Integration guide
- [ ] Demo page
- [ ] Widget tests

**Deliverables:**

- Deployed widget
- Integration docs
- Demo page
- Widget tests

### Sprint 4 Definition of Done

- [ ] Widget embeddable via script tag
- [ ] Chat UI functional
- [ ] Streaming responses working
- [ ] Customizable styling
- [ ] Integration guide complete
- [ ] All tests passing

---

## Sprint 5: Polish & Launch

**Duration:** Week 6 (5 days)
**Goal:** Testing, monitoring, documentation, and deployment

### Day 1: Testing & Quality

**Tasks:**

- [ ] End-to-end tests
- [ ] Integration tests
- [ ] Load testing (simulate concurrent users)
- [ ] Security audit
- [ ] Bug fixing
- [ ] Performance optimization

**Deliverables:**

- Test suite
- Load test results
- Security audit report
- Bug fixes

### Day 2: Observability

**Tasks:**

- [ ] Request logging implementation
  - Log all API calls
  - Correlation IDs
  - Structured logging
- [ ] Usage metrics
  - Message count per tenant
  - Token usage
  - Cost estimates
- [ ] Error tracking
  - Error aggregation
  - Alerting (basic)
- [ ] Cloudflare Analytics integration

**Deliverables:**

- Logging system
- Metrics dashboard
- Error tracking

### Day 3: Documentation

**Tasks:**

- [ ] Complete README
- [ ] API documentation
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] Architecture diagrams
- [ ] Contributing guidelines

**Deliverables:**

- Complete documentation
- API reference
- Deployment guide

### Day 4: Deployment

**Tasks:**

- [ ] Production D1 database setup
- [ ] Production KV namespace
- [ ] Production Workers deployment
- [ ] Custom domain (api.clawless.dev)
- [ ] Environment configuration
- [ ] Secret management
- [ ] Deployment runbook

**Deliverables:**

- Production deployment
- Deployment docs
- Runbook

### Day 5: Launch Preparation

**Tasks:**

- [ ] Pre-launch checklist
- [ ] Smoke tests
- [ ] Rollback plan
- [ ] Onboarding first beta tenant
- [ ] Monitoring setup
- [ ] Launch announcement

**Deliverables:**

- Launch checklist
- Beta tenant onboarded
- Monitoring active

### Sprint 5 Definition of Done

- [ ] All tests passing
- [ ] Documentation complete
- [ ] Deployed to production
- [ ] Monitoring active
- [ ] Beta tenant using platform
- [ ] Ready for public launch

---

## Post-MVP Roadmap

### Phase 2: Features (Weeks 7-10)

- Webhook notifications
- Advanced tool marketplace
- Admin dashboard UI
- Custom domains support

### Phase 3: Scale (Weeks 11-14)

- Multi-region deployment
- Caching optimization
- Database sharding strategy
- Advanced monitoring

### Phase 4: Ecosystem (Weeks 15+)

- Channel connectors (Slack, Discord)
- Voice support (Twilio)
- RAG capabilities
- Multi-agent workflows

---

## Sprint Ceremonies

### Daily Standup

- **Time:** 15 minutes
- **Format:** Async (written) or sync (video)
- **What:** Yesterday, Today, Blockers

### Sprint Planning

- **Time:** 1 hour (start of sprint)
- **What:** Review backlog, estimate tasks, commit to sprint

### Sprint Review

- **Time:** 30 minutes (end of sprint)
- **What:** Demo completed work, gather feedback

### Retrospective

- **Time:** 30 minutes (end of sprint)
- **What:** What went well, what didn't, improvements

---

## Metrics & KPIs

### Sprint Health

- Velocity (story points completed)
- Sprint goal achievement
- Bug count
- Test coverage

### Product Metrics

- Active tenants
- Messages processed
- API success rate
- p95 latency
- Cost per 1K messages

---

## Risk Management

| Risk                            | Impact   | Probability | Mitigation                         |
| ------------------------------- | -------- | ----------- | ---------------------------------- |
| Workers AI quality insufficient | High     | Medium      | Hybrid routing to premium LLMs     |
| Cloudflare limits reached       | Medium   | Low         | Design for horizontal scaling      |
| Multi-tenant data leakage       | Critical | Low         | Extensive testing + security audit |
| Slow time-to-first-token        | High     | Medium      | KV caching + model warm-up         |
| Complex deployment              | Medium   | Low         | Comprehensive documentation        |

---

## Dependencies

### External

- Cloudflare Workers account
- Cloudflare D1 database
- Anthropic API account (optional/fallback)
- OpenAI API account (optional/fallback)
- Domain name (custom)

### Internal

- Planning documents (complete)
- Architecture decisions (complete)
- Developer availability

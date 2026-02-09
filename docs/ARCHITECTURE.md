# Architecture

**Project:** Clawless - Multi-Tenant Serverless AI Platform
**Last Updated:** 2025-02-08

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Cloudflare Edge                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Cloudflare Workers                        │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │  │
│  │  │   API GW    │ │  WebChat    │ │   Webhooks  │              │  │
│  │  │  (Worker)   │ │  (Worker)   │ │  (Worker)   │              │  │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘              │  │
│  │         │                │                │                    │  │
│  │  ┌──────▼────────────────▼────────────────▼──────┐           │  │
│  │  │              Core Runtime (Worker)             │           │  │
│  │  │  - Tenant routing & isolation                  │           │  │
│  │  │  - Session management                         │           │  │
│  │  │  - LLM orchestration                          │           │  │
│  │  │  - Tool execution                             │           │  │
│  │  └──────┬────────────────────────────────────────┘           │  │
│  └─────────┼───────────────────────────────────────────────────┘  │
│            │                                                      │
└────────────┼──────────────────────────────────────────────────────┘
             │
    ┌────────▼────────┐
    │  Cloudflare D1  │  (SQLite - tenant data, sessions)
    │  Cloudflare KV  │  (cache, rate limits)
    │  Cloudflare R2  │  (files, artifacts)
    └─────────────────┘
```

---

## Core Components

### 1. API Gateway Worker

**File:** `src/workers/api-gateway.ts`

**Responsibilities:**

- HTTP request routing
- Authentication (API keys, JWT)
- Rate limiting
- Request validation
- Response formatting

**Endpoints:**

```
POST   /v1/chat/completions    - Chat with assistant
GET    /v1/sessions             - List sessions
POST   /v1/sessions             - Create session
GET    /v1/sessions/:id         - Get session
DELETE /v1/sessions/:id         - Delete session
POST   /v1/sessions/:id/reset   - Reset session context
```

### 2. WebChat Worker

**File:** `src/workers/webchat.ts`

**Responsibilities:**

- Serve embeddable JS widget
- WebSocket for real-time chat
- CORS handling for tenant domains
- Session persistence

### 3. Core Runtime

**File:** `src/core/runtime.ts`

**Responsibilities:**

- Tenant context resolution
- Session management
- LLM client orchestration
- Tool execution
- Response streaming

---

## Data Model

### D1 Database Schema

```sql
-- Tenants
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  settings TEXT,  -- JSON: model config, prompts, etc.
  quotas TEXT,    -- JSON: message limits, token limits
  status TEXT DEFAULT 'active'  -- active, suspended, deleted
);

CREATE INDEX idx_tenants_status ON tenants(status);

-- API Keys
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT,  -- JSON: array of permissions
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  expires_at DATETIME,
  status TEXT DEFAULT 'active',
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  external_id TEXT,  -- Optional external session ID
  model TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,  -- JSON: thinking level, verbose mode, etc.
  status TEXT DEFAULT 'active'
);

CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX idx_sessions_external ON sessions(external_id);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- user, assistant, system, tool
  content TEXT NOT NULL,
  tool_calls TEXT,     -- JSON: tool call details
  tool_call_id TEXT,   -- For tool response messages
  tokens_used INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- Tool Executions (for audit/debug)
CREATE TABLE tool_executions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT,
  tool_name TEXT NOT NULL,
  input_data TEXT,     -- JSON
  output_data TEXT,    -- JSON
  error_message TEXT,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_tool_executions_session ON tool_executions(session_id);
```

---

## Tenant Isolation Strategy

### 1. Data Isolation

- **Row-Level Security:** All queries include tenant_id filter
- **API Key Binding:** Keys are scoped to single tenant
- **Session Separation:** Sessions never cross tenant boundaries

### 2. Compute Isolation

- **Per-Request Context:** Tenant context attached to each request
- **Resource Limits:** CPU/memory limits per request (Cloudflare enforced)
- **Separate Worker Instances:** Each request gets isolated V8 isolate

### 3. Configuration Isolation

- **Tenant-Specific Settings:** Model, prompts, tools per tenant
- **Quota Enforcement:** Message/token limits checked per request
- **Custom Tools:** Tenant can define private tools

---

## Authentication & Authorization

### API Key Authentication

```
1. Client sends: Authorization: Bearer <api-key>
2. API GW validates key hash against D1
3. Tenant context loaded from key
4. Scopes/permissions checked
5. Request proceeds with tenant context
```

### JWT (Future)

- For web dashboard authentication
- Short-lived tokens with refresh
- Claims: tenant_id, user_id, scopes

---

## LLM Integration

### Hybrid Strategy: Workers AI + Premium Providers

**Cost-optimized approach:** Default to Workers AI for most queries, route to Anthropic/OpenAI for complex tasks requiring top-tier models.

### Supported Providers

| Provider       | Models            | Input Cost | Output Cost | Use Case                |
| -------------- | ----------------- | ---------- | ----------- | ----------------------- |
| **Workers AI** | Llama 3.1 8B fast | $0.045/M   | $0.384/M    | Simple queries, default |
| **Workers AI** | Llama 3.1 8B awq  | $0.123/M   | $0.266/M    | Balanced quality/speed  |
| **Workers AI** | Llama 3.3 70B     | $0.293/M   | $2.253/M    | Complex reasoning       |
| **Workers AI** | Gemma 3 12B       | $0.345/M   | $0.556/M    | Multilingual            |
| **Anthropic**  | Claude Haiku      | $0.80/M    | $1.00/M     | High quality simple     |
| **Anthropic**  | Claude Sonnet 4.5 | $3.00/M    | $15.00/M    | Complex, code           |
| **Anthropic**  | Claude Opus 4.6   | $15.00/M   | $75.00/M    | Deepest reasoning       |
| **OpenAI**     | GPT-4o-mini       | $0.15/M    | $0.60/M     | Fast quality            |
| **OpenAI**     | GPT-4o            | $2.50/M    | $10.00/M    | Vision tasks            |

### Cost Comparison

| Task              | Workers AI (Llama 8B) | Anthropic (Haiku) | Anthropic (Sonnet) | Savings           |
| ----------------- | --------------------- | ----------------- | ------------------ | ----------------- |
| Simple query      | ~$0.0005              | ~$0.002           | ~$0.01             | **4-20x cheaper** |
| Code generation   | ~$0.001               | ~$0.003           | ~$0.02             | **3-20x cheaper** |
| Complex reasoning | ~$0.005               | ~$0.01            | ~$0.05             | **2-10x cheaper** |

**Estimated monthly savings for 1M messages:**

- Workers AI only: ~$500-1,000 (LLM costs)
- Anthropic Haiku only: ~$2,000-4,000
- Anthropic Sonnet only: ~$10,000-20,000
- **Hybrid approach: ~$1,000-3,000** (60-90% savings vs premium-only)

### LLM Client Interface

```typescript
interface LLMClient {
  chat(params: ChatParams): AsyncIterable<ChatChunk>;
  complete(params: ChatParams): Promise<ChatMessage>;
}

interface ChatParams {
  messages: ChatMessage[];
  model: string;
  tools?: Tool[];
  thinkingLevel?: ThinkingLevel;
  maxTokens?: number;
}
```

### Streaming Architecture

```
LLM Provider → Cloudflare Worker → Server-Sent Events → Client
     ↓              ↓                       ↓
  chunks        transform              forward to client
```

---

## Tool System

### Built-in Tools

| Tool          | Description                 | MVP |
| ------------- | --------------------------- | --- |
| browser       | Web automation via CDP      | No  |
| canvas        | Visual workspace            | No  |
| file_read     | Read files (tenant-scoped)  | Yes |
| file_write    | Write files (tenant-scoped) | Yes |
| sessions_list | Discover sessions           | Yes |
| sessions_send | Message other sessions      | Yes |

### Custom Tools

Tenants can define HTTP endpoints as tools:

```json
{
  "name": "get_weather",
  "endpoint": "https://api.example.com/weather",
  "method": "POST",
  "authentication": "bearer_token",
  "schema": {
    "parameters": {
      "location": { "type": "string" }
    }
  }
}
```

### Tool Execution Flow

```
1. LLM requests tool call
2. Runtime validates tool permission
3. Execute tool (built-in or HTTP)
4. Return result to LLM
5. LLM generates final response
```

---

## Caching Strategy

### Cloudflare KV Cache

- **Session summaries:** Cached after compaction
- **Tenant config:** Cached with TTL
- **Rate limit counters:** Sliding window

### Cache Keys

```
tenant:${tenantId}:config
session:${sessionId}:summary
ratelimit:${tenantId}:${window}
```

---

## Error Handling

### Error Types

| Type                 | HTTP Status | Description             |
| -------------------- | ----------- | ----------------------- |
| ValidationError      | 400         | Invalid request body    |
| AuthenticationError  | 401         | Invalid/missing API key |
| RateLimitError       | 429         | Quota exceeded          |
| TenantNotFoundError  | 404         | Tenant not found        |
| SessionNotFoundError | 404         | Session not found       |
| LLMError             | 502         | LLM provider error      |
| InternalError        | 500         | Unexpected error        |

### Error Response Format

```json
{
  "error": {
    "type": "rate_limit_exceeded",
    "message": "Monthly message quota exceeded",
    "details": {
      "quota": 10000,
      "used": 10000,
      "resets_at": "2025-03-01T00:00:00Z"
    },
    "request_id": "req_abc123"
  }
}
```

---

## Deployment Architecture

### Environments

| Environment | Purpose        | Domain               |
| ----------- | -------------- | -------------------- |
| Development | Local testing  | localhost            |
| Staging     | Pre-production | staging.clawless.dev |
| Production  | Live service   | api.clawless.dev     |

### CI/CD Pipeline

```
1. Push to main branch
2. GitHub Actions trigger
3. Run tests (Vitest)
4. Build Workers (Wrangler)
5. Deploy to Staging
6. Run integration tests
7. Promote to Production (manual)
```

### Environment Variables

```bash
# Cloudflare
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_API_TOKEN=xxx

# LLM Providers (in Cloudflare Secrets)
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx

# Application
ENVIRONMENT=production
LOG_LEVEL=info
```

---

## Monitoring & Observability

### Metrics (Cloudflare Analytics)

- Request count by endpoint
- Error rate by type
- Response latency (p50, p95, p99)
- Tenant request distribution

### Logging

```typescript
// Structured logging
logger.info('chat_completion', {
  tenant_id: tenant.id,
  session_id: session.id,
  model: params.model,
  tokens_used: result.usage.total_tokens,
  duration_ms: Date.now() - start,
});
```

### Tracing

- Request ID propagation
- Distributed tracing (future)
- Performance profiling

---

## Security Considerations

### Threat Model

| Threat                | Mitigation                                |
| --------------------- | ----------------------------------------- |
| API key leakage       | Key hashing, rotation support             |
| Tenant data leakage   | Row-level security, isolation checks      |
| DoS attacks           | Rate limiting, Cloudflare DDoS protection |
| Prompt injection      | Sanitization, thinking level controls     |
| LLM data exfiltration | Tool permission model, sandboxing         |

### Best Practices

- All API calls authenticated
- No tenant cross-talk
- Secrets in Cloudflare Secrets, not code
- Regular security audits
- Dependency scanning (Dependabot)

---

## Technology Stack

| Component  | Technology              |
| ---------- | ----------------------- |
| Runtime    | Cloudflare Workers (V8) |
| Language   | TypeScript              |
| Database   | Cloudflare D1 (SQLite)  |
| Cache      | Cloudflare KV           |
| Storage    | Cloudflare R2           |
| Deployment | Wrangler CLI            |
| Testing    | Vitest                  |
| CI/CD      | GitHub Actions          |
| Monitoring | Cloudflare Analytics    |

---

## Architecture Decisions Record

| ID      | Decision                                  | Date       | Rationale                                                                                                                                                                           |
| ------- | ----------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-001 | LLM Strategy: Workers AI + Premium hybrid | 2025-02-09 | Default to Workers AI (5-20x cheaper). Route complex queries to Anthropic/OpenAI for premium tenants. Optimizes cost while maintaining quality.                                     |
| ADR-002 | Session Storage: KV cache + D1            | 2025-02-09 | Active sessions cached in KV for fast reads, persisted in D1. Cache TTL: 5 minutes. Balances performance with data durability.                                                      |
| ADR-003 | Data Retention: 30 days default           | 2025-02-09 | Conversations retained 30 days default. Tenants can extend with paid tiers. Balances cost with compliance/debugging needs.                                                          |
| ADR-004 | Custom Domains: Post-MVP                  | 2025-02-09 | Use api.clawless.dev for MVP. Custom domains require TLS provisioning, DNS validation, Let's Encrypt integration. Defer to post-MVP.                                                |
| ADR-005 | Multi-region: Single region for MVP       | 2025-02-09 | D1 doesn't support multi-region replication yet. Deploy to primary region (US-East) for MVP. Re-evaluate when Cloudflare adds support.                                              |
| ADR-006 | Websockets: Use SSE for MVP               | 2025-02-09 | Cloudflare Workers have websocket limits and connection restrictions. Server-Sent Events (SSE) sufficient for streaming responses. Consider websockets for bidirectional in future. |

---

## Model Routing Strategy

### Hybrid Smart Routing

```typescript
interface RouteDecision {
  provider: 'workers' | 'anthropic' | 'openai';
  model: string;
  reasoning: string;
}

function selectModel(query: string, context: SessionContext): RouteDecision {
  // Simple queries → Workers AI Llama 8B (cheapest)
  if (isSimpleQuery(query)) {
    return {
      provider: 'workers',
      model: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
      reasoning: 'simple_query_workers_ai',
    };
  }

  // Code tasks → Workers AI Llama 8B awq or Anthropic Haiku
  if (context.hasCodeBlocks || query.includes('code')) {
    if (context.tier === 'enterprise') {
      return {
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
        reasoning: 'code_task_premium',
      };
    }
    return {
      provider: 'workers',
      model: '@cf/meta/llama-3.1-8b-instruct-awq',
      reasoning: 'code_task_workers_ai',
    };
  }

  // Complex reasoning → Anthropic Sonnet/Opus or Workers AI 70B
  if (isComplexQuery(query) || context.requiresDeepAnalysis) {
    if (context.tier === 'enterprise' || context.tier === 'business') {
      return {
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
        reasoning: 'complex_reasoning_premium',
      };
    }
    return {
      provider: 'workers',
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      reasoning: 'complex_reasoning_workers_ai',
    };
  }

  // Default to Workers AI for cost efficiency
  return {
    provider: 'workers',
    model: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
    reasoning: 'default_workers_ai',
  };
}
```

### Query Classification Heuristics

| Query Type | Indicators                                  | Default Model | Premium Override        |
| ---------- | ------------------------------------------- | ------------- | ----------------------- |
| Simple     | < 100 chars, single question, no context    | Llama 8B fast | -                       |
| Code       | Contains code blocks, "write code", "debug" | Llama 8B awq  | Sonnet (Enterprise)     |
| Complex    | Multi-step, "analyze", "compare", strategic | Llama 70B     | Sonnet/Opus (Business+) |
| Vision     | Images, "describe this image"               | GPT-4o        | -                       |
| Default    | Everything else                             | Llama 8B fast | -                       |

### Tenant Override

Tenants can override routing by specifying `provider` and `model`:

```json
{
  "messages": [...],
  "provider": "anthropic",
  "model": "claude-opus-4.6"
}
```

### Workers AI Integration Benefits

| Benefit         | Description                                          |
| --------------- | ---------------------------------------------------- |
| **Cost**        | 5-20x cheaper than Anthropic/OpenAI                  |
| **Latency**     | Already on Cloudflare edge, no external API calls    |
| **Reliability** | Same infrastructure as Workers, fewer failure points |
| **Simplicity**  | Single platform billing, no separate API keys needed |

---

## Session Storage Strategy

### Two-Tier Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Request Flow                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Check KV cache (fast path)                          │
│     └─ Hit? Return cached session                       │
│                                                         │
│  2. Miss? Query D1 (slow path)                          │
│     └─ Load session + messages                          │
│                                                         │
│  3. Write to KV for next request                        │
│     └─ TTL: 5 minutes                                   │
│                                                         │
│  4. Update D1 asynchronously                            │
│     └─ Ensure persistence                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### KV Cache Schema

```
Key: session:${sessionId}
Value: {
  id: string,
  tenant_id: string,
  model: string,
  messages: Message[],
  metadata: Record<string, unknown>,
  updated_at: number
}
TTL: 300 seconds (5 minutes)
```

### Cache Invalidation

- **Time-based:** 5 minute TTL ensures fresh data
- **Write-through:** D1 updates invalidate cache entry
- **Session reset:** Explicit cache delete on reset

---

## Remaining Technical Considerations

### Post-MVP Items

The following are deferred to post-MVP:

1. **Custom Domain Support** - Requires DNS validation, TLS automation
2. **WebSocket Transport** - SSE sufficient for MVP streaming
3. **Multi-region D1** - Awaiting Cloudflare platform support
4. **Advanced Model Routing** - ML-based query classification

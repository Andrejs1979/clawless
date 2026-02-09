-- Clawless Database Schema
-- Cloudflare D1 (SQLite)

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT DEFAULT 'starter' CHECK(tier IN ('starter', 'pro', 'business', 'enterprise')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  settings TEXT,  -- JSON: model config, prompts, etc.
  quotas TEXT,    -- JSON: message limits, token limits
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_tier ON tenants(tier);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT,  -- JSON: array of permissions
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  expires_at DATETIME,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'revoked')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  external_id TEXT,  -- Optional external session ID
  model TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('workers', 'anthropic', 'openai')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,  -- JSON: thinking level, verbose mode, etc.
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'deleted')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_external ON sessions(external_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls TEXT,     -- JSON: tool call details
  tool_call_id TEXT,   -- For tool response messages
  tokens_used INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Tool Executions (for audit/debug)
CREATE TABLE IF NOT EXISTS tool_executions (
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

CREATE INDEX IF NOT EXISTS idx_tool_executions_session ON tool_executions(session_id);

-- Usage Tracking (aggregated)
CREATE TABLE IF NOT EXISTS usage_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  period TEXT NOT NULL,  -- e.g., '2025-01'
  messages_sent INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  llm_cost_cents INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, period),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_tenant ON usage_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_period ON usage_metrics(period);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL,  -- Public webhook identifier
  url TEXT NOT NULL,
  events TEXT,  -- JSON: array of event types
  secret TEXT,  -- For signature verification
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_triggered_at DATETIME,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_id ON webhooks(webhook_id);

-- Request Logs (for debugging/troubleshooting)
CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT,
  request_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_request_logs_tenant ON request_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_session ON request_logs(session_id);

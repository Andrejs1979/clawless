# Product Requirements Document (PRD)

## Clawless - Multi-Tenant Serverless AI Platform

**Version:** 1.0
**Last Updated:** 2025-02-08
**Status:** Draft

---

## Executive Summary

**Clawless** is a multi-tenant serverless platform that provides AI assistant capabilities as a service. Unlike OpenClaw (single-user, self-hosted), Clawless enables organizations to deploy and manage AI assistants at scale with tenant isolation, flexible LLM backends, and a serverless architecture powered by Cloudflare Workers.

### Key Differentiator from OpenClaw

| Aspect       | OpenClaw                 | Clawless                         |
| ------------ | ------------------------ | -------------------------------- |
| Deployment   | Self-hosted, single-user | Cloudflare Workers, multi-tenant |
| Channels     | 12+ messaging platforms  | API-first, extensible channels   |
| Architecture | Monolithic Gateway       | Serverless functions             |
| Target       | Individual users         | Teams, organizations, SaaS       |

---

## Problem Statement

Organizations want to deploy AI assistants that:

1. **Scale automatically** without managing infrastructure
2. **Isolate tenants** - each team/customer gets their own assistant instance
3. **Support multiple channels** - web, API, and integrations
4. **Control costs** with usage-based pricing and quotas
5. **Deploy globally** with low latency

Existing solutions require:

- Expensive infrastructure (VMs, Kubernetes)
- Complex multi-tenancy patterns
- Manual scaling and operations
- Vendor lock-in to single cloud providers

---

## Solution: Serverless Multi-Tenant Platform

### Core Value Propositions

1. **Zero Infrastructure** - Deploy to Cloudflare Workers in seconds
2. **True Multi-Tenancy** - Tenant isolation at data and routing level
3. **Pay-Per-Use** - Only pay for actual API/LLM calls
4. **Global Edge** - Automatic global deployment via Cloudflare
5. **Channel Agnostic** - Web, API, webhooks, or custom integrations

---

## Target Users

### Primary

- **SaaS Companies** - Add AI assistants to their products
- **Agencies** - Deploy branded AI assistants for clients
- **Enterprises** - Internal AI tools with department isolation

### Secondary

- **Developers** - Build AI-powered apps without infrastructure
- **MVP Builders** - Quick AI assistant deployment

---

## Core Features (MVP)

### 1. Tenant Management

- Onboard tenants via API or dashboard
- Per-tenant API keys and webhooks
- Usage quotas and limits
- Tenant configuration (models, prompts, tools)

### 2. Assistant Runtime

- Multi-LLM support (Anthropic, OpenAI, others)
- Streaming responses
- Tool/function calling
- Session management
- Context window management

### 3. Channels

- **WebChat** - Embeddable widget
- **API** - REST/GraphQL endpoints
- **Webhooks** - For external integrations
- _(Post-MVP: Slack, Discord, WhatsApp)_

### 4. Tools & Skills

- Built-in tools: browser, canvas, file operations
- Custom tool definitions per tenant
- Tool permission model

### 5. Observability

- Per-tenant usage metrics
- Cost tracking
- Request/response logging
- Error tracking

---

## Non-MVP Features (Future)

- Voice support (Twilio integration)
- Mobile SDKs (iOS/Android)
- Channel connectors (Slack, Discord, Teams)
- Custom model fine-tuning
- Vector store integration for RAG
- Scheduled tasks/cron
- Multi-agent workflows

---

## Technical Requirements

### Architecture

- **Runtime:** Cloudflare Workers (V8 isolate)
- **Storage:** Cloudflare D1 (SQLite), KV, R2
- **API:** REST with WebSocket support
- **Auth:** JWT-based tenant authentication
- **LLM:** Workers AI (primary) + Anthropic/OpenAI (premium routing)

### Performance

- Cold start < 100ms
- Time to first token < 500ms
- Global edge distribution
- Auto-scaling to zero

### Security

- Tenant data isolation
- API key authentication
- Rate limiting per tenant
- Input validation and sanitization
- DMARC/SPF for email channels

---

## Success Metrics

### Technical

- 99.9% uptime SLA
- p95 latency < 1s
- Zero tenant data leakage
- Auto-scale to 10K concurrent tenants
- **90%+ queries on Workers AI** (cost optimization goal)

### Business

- Time to onboard: < 5 minutes
- Cost per 1K messages: <$0.20 with Workers AI (vs ~$1-3 with premium LLMs)
- Tenant churn: < 5% monthly
- API success rate: > 99.5%

---

## Pricing Model

### Tiered Subscriptions + LLM Pass-Through

| Tier           | Price   | Messages/Month | Included Tokens   | Overages      |
| -------------- | ------- | -------------- | ----------------- | ------------- |
| **Starter**    | $29/mo  | 1,000          | 100K input tokens | $0.03/message |
| **Pro**        | $99/mo  | 10,000         | 1M input tokens   | $0.02/message |
| **Business**   | $299/mo | 50,000         | 5M input tokens   | $0.01/message |
| **Enterprise** | Custom  | Unlimited      | Custom            | Custom        |

### LLM Cost Structure

- Platform fee covers infrastructure, support, margin
- **Workers AI:** ~$0.0005 per message (default, 90%+ of queries)
- **Premium LLMs:** ~$0.01-0.05 per message (complex tasks, Enterprise)
- Costs passed through at actual cost (transparent billing)
- Separate line items on invoices for clarity

**Estimated LLM costs per 1K messages:**

- Starter/Pro tier (Workers AI): ~$0.50
- Business tier (mixed): ~$1-2
- Enterprise tier (premium heavy): ~$5-10

### Trial

- 14-day free trial on all tiers (no credit card required)

---

## Dependencies

- Cloudflare Workers paid plan
- Anthropic/OpenAI API accounts
- GitHub repository (this project)
- Project board: https://github.com/users/Andrejs1979/projects/140

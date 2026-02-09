/**
 * Core type definitions
 */

/**
 * Tenant status
 */
export type TenantStatus = 'active' | 'suspended' | 'deleted';

/**
 * Message role
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Thinking level for extended reasoning
 */
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'high';

/**
 * LLM provider
 */
export type LLMProvider = 'workers' | 'anthropic' | 'openai';

/**
 * Chat message
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

/**
 * Tool/function call
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Tool definition
 */
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  provider?: LLMProvider;
  tools?: Tool[];
  thinkingLevel?: ThinkingLevel;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  sessionId?: string;
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  tenantId: string;
  sessionId: string;
  message: ChatMessage;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: LLMProvider;
}

/**
 * Session
 */
export interface Session {
  id: string;
  tenantId: string;
  externalId?: string;
  model: string;
  provider: LLMProvider;
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    thinkingLevel?: ThinkingLevel;
    verbose?: boolean;
    [key: string]: unknown;
  };
  status: 'active' | 'archived' | 'deleted';
}

/**
 * Tenant
 */
export interface Tenant {
  id: string;
  name: string;
  createdAt: Date;
  settings: TenantSettings;
  quotas: TenantQuotas;
  status: TenantStatus;
}

/**
 * Tenant settings
 */
export interface TenantSettings {
  defaultModel: string;
  defaultProvider: LLMProvider;
  systemPrompt?: string;
  allowedTools: string[];
  customTools?: Tool[];
}

/**
 * Tenant quotas
 */
export interface TenantQuotas {
  monthlyMessages: number;
  monthlyTokens: number;
  overagesAllowed: boolean;
}

/**
 * API key
 */
export interface ApiKey {
  id: string;
  tenantId: string;
  keyHash: string;
  scopes?: string[];
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  status: 'active' | 'revoked';
}

/**
 * Tenant plan/tier
 */
export type TenantTier = 'starter' | 'pro' | 'business' | 'enterprise';

/**
 * Plan configuration
 */
export interface PlanConfig {
  tier: TenantTier;
  monthlyMessages: number;
  monthlyTokens: number;
  includedModels: string[];
  overagesAllowed: boolean;
  overagePricePerMessage: number;
}

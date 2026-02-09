/**
 * Smart Model Routing
 * Selects optimal LLM provider based on cost, quality, and tenant tier
 */

import type { Env } from '@/index';
import type { LLMProvider, TenantTier } from '@/types';

import { isProviderAvailable } from './index';

/**
 * Provider capabilities
 */
interface ProviderCapability {
  provider: LLMProvider;
  quality: 'low' | 'medium' | 'high';
  costPer1kTokens: number;
  maxTokens: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  requiresApiKey: boolean;
}

/**
 * Provider capability matrix
 */
const PROVIDERS: Record<LLMProvider, ProviderCapability> = {
  workers: {
    provider: 'workers',
    quality: 'low',
    costPer1kTokens: 0,
    maxTokens: 4096,
    supportsTools: false,
    supportsStreaming: true,
    requiresApiKey: false,
  },
  anthropic: {
    provider: 'anthropic',
    quality: 'high',
    costPer1kTokens: 0.25, // Haiku pricing
    maxTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
    requiresApiKey: true,
  },
  openai: {
    provider: 'openai',
    quality: 'high',
    costPer1kTokens: 0.15, // GPT-4o-mini pricing
    maxTokens: 16384,
    supportsTools: true,
    supportsStreaming: true,
    requiresApiKey: true,
  },
};

/**
 * Tenant tier defaults
 */
const TIER_DEFAULTS: Record<TenantTier, { defaultProvider: LLMProvider; allowPremium: boolean }> = {
  starter: { defaultProvider: 'workers', allowPremium: false },
  pro: { defaultProvider: 'anthropic', allowPremium: true },
  business: { defaultProvider: 'anthropic', allowPremium: true },
  enterprise: { defaultProvider: 'anthropic', allowPremium: true },
};

/**
 * Routing options
 */
export interface RoutingOptions {
  tenantTier?: TenantTier;
  tenantQuotas?: { monthlyMessages: number };
  requestedProvider?: LLMProvider;
  requiresTools?: boolean;
  requiresStreaming?: boolean;
  qualityPreference?: 'cost' | 'balanced' | 'quality';
  maxTokens?: number;
}

/**
 * Routing result
 */
export interface RoutingResult {
  provider: LLMProvider;
  model: string;
  reason: string;
}

/**
 * Route a request to the optimal provider
 */
export function routeRequest(options: RoutingOptions, env: Env): RoutingResult {
  const tenantTier = options.tenantTier || inferTierFromQuotas(options.tenantQuotas);
  const tierConfig = TIER_DEFAULTS[tenantTier];

  // If user explicitly requested a provider
  if (options.requestedProvider) {
    const provider = PROVIDERS[options.requestedProvider];

    // Check if provider is available
    if (provider.requiresApiKey && !isProviderAvailable(provider.provider, env)) {
      // Fallback to workers if API key not configured
      return {
        provider: 'workers',
        model: '@cf/meta/llama-3.1-8b-instruct',
        reason: 'Requested provider unavailable, using Workers AI fallback',
      };
    }

    // Check tier restrictions
    if (!tierConfig.allowPremium && provider.costPer1kTokens > 0) {
      return {
        provider: 'workers',
        model: '@cf/meta/llama-3.1-8b-instruct',
        reason: 'Requested provider not available on starter tier',
      };
    }

    return {
      provider: provider.provider,
      model: getDefaultModel(provider.provider),
      reason: 'Using requested provider',
    };
  }

  // Auto-select based on preferences
  return selectBestProvider(options, tierConfig, env);
}

/**
 * Select best provider based on quality preference and availability
 */
function selectBestProvider(
  options: RoutingOptions,
  tierConfig: { defaultProvider: LLMProvider; allowPremium: boolean },
  env: Env
): RoutingResult {
  const preference = options.qualityPreference || 'balanced';
  const requiresTools = options.requiresTools || false;
  const requiresStreaming = options.requiresStreaming || false;

  // Filter available providers
  let candidates = Object.values(PROVIDERS).filter((p) => {
    // Check tier restrictions
    if (!tierConfig.allowPremium && p.costPer1kTokens > 0) {
      return false;
    }

    // Check API key availability
    if (p.requiresApiKey && !isProviderAvailable(p.provider, env)) {
      return false;
    }

    // Check feature requirements
    if (requiresTools && !p.supportsTools) {
      return false;
    }

    if (requiresStreaming && !p.supportsStreaming) {
      return false;
    }

    // Check max tokens requirement
    if (options.maxTokens && options.maxTokens > p.maxTokens) {
      return false;
    }

    return true;
  });

  // If no candidates, use Workers AI (always available)
  if (candidates.length === 0) {
    return {
      provider: 'workers',
      model: '@cf/meta/llama-3.1-8b-instruct',
      reason: 'No suitable providers found, using Workers AI fallback',
    };
  }

  // Sort candidates by preference
  candidates.sort((a, b) => {
    switch (preference) {
      case 'cost':
        return a.costPer1kTokens - b.costPer1kTokens;
      case 'quality': {
        const qualityOrder = { high: 3, medium: 2, low: 1 };
        return qualityOrder[b.quality] - qualityOrder[a.quality];
      }
      case 'balanced': {
        // Prefer tier default, then balance cost/quality
        if (a.provider === tierConfig.defaultProvider) return -1;
        if (b.provider === tierConfig.defaultProvider) return 1;
        const aScore = a.quality === 'high' ? 2 : 1;
        const bScore = b.quality === 'high' ? 2 : 1;
        return b.costPer1kTokens * bScore - a.costPer1kTokens * aScore;
      }
      default:
        return 0;
    }
  });

  const selected = candidates[0]!;

  return {
    provider: selected.provider,
    model: getDefaultModel(selected.provider),
    reason: `Auto-selected based on ${preference} preference`,
  };
}

/**
 * Get default model for a provider
 */
function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'workers':
      return '@cf/meta/llama-3.1-8b-instruct';
    case 'anthropic':
      return 'claude-3-5-haiku-20241022';
    case 'openai':
      return 'gpt-4o-mini';
  }
}

/**
 * Infer tenant tier from quotas
 */
function inferTierFromQuotas(quotas?: { monthlyMessages: number }): TenantTier {
  if (!quotas) return 'starter';
  if (quotas.monthlyMessages >= 1_000_000) return 'enterprise';
  if (quotas.monthlyMessages >= 100_000) return 'business';
  if (quotas.monthlyMessages >= 10_000) return 'pro';
  return 'starter';
}

/**
 * Get estimated cost for a completion
 */
export function estimateCost(
  provider: LLMProvider,
  promptTokens: number,
  completionTokens: number
): number {
  const config = PROVIDERS[provider];
  const totalTokens = promptTokens + completionTokens;
  return (totalTokens / 1000) * config.costPer1kTokens;
}

/**
 * Check if a provider is available for a tenant
 */
export function isProviderAllowed(
  provider: LLMProvider,
  tenantTier: TenantTier,
  env: Env
): boolean {
  const tierConfig = TIER_DEFAULTS[tenantTier];
  const providerConfig = PROVIDERS[provider];

  if (!tierConfig.allowPremium && providerConfig.costPer1kTokens > 0) {
    return false;
  }

  if (providerConfig.requiresApiKey && !isProviderAvailable(provider, env)) {
    return false;
  }

  return true;
}

/**
 * Plan configurations and pricing
 */

import type { PlanConfig, TenantTier } from '@/types';

/**
 * Plan definitions
 */
export const PLANS: Record<TenantTier, PlanConfig> = {
  starter: {
    tier: 'starter',
    monthlyMessages: 1_000,
    monthlyTokens: 100_000,
    includedModels: ['@cf/meta/llama-3.1-8b-instruct-fp8-fast'],
    overagesAllowed: true,
    overagePricePerMessage: 0.03,
  },
  pro: {
    tier: 'pro',
    monthlyMessages: 10_000,
    monthlyTokens: 1_000_000,
    includedModels: [
      '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
      '@cf/meta/llama-3.1-8b-instruct-awq',
    ],
    overagesAllowed: true,
    overagePricePerMessage: 0.02,
  },
  business: {
    tier: 'business',
    monthlyMessages: 50_000,
    monthlyTokens: 5_000_000,
    includedModels: [
      '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
      '@cf/meta/llama-3.1-8b-instruct-awq',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/google/gemma-3-12b-it-fp8',
    ],
    overagesAllowed: true,
    overagePricePerMessage: 0.01,
  },
  enterprise: {
    tier: 'enterprise',
    monthlyMessages: -1, // Unlimited
    monthlyTokens: -1, // Unlimited
    includedModels: [
      // All Workers AI models
      '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
      '@cf/meta/llama-3.1-8b-instruct-awq',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/google/gemma-3-12b-it-fp8',
      // Anthropic models
      'claude-haiku-4.5',
      'claude-sonnet-4.5',
      'claude-opus-4.6',
      // OpenAI models
      'gpt-4o-mini',
      'gpt-4o',
    ],
    overagesAllowed: true,
    overagePricePerMessage: 0,
  },
};

/**
 * Get plan configuration for a tier
 */
export function getPlanConfig(tier: TenantTier): PlanConfig {
  return PLANS[tier];
}

/**
 * Model to provider mapping
 */
export const MODEL_PROVIDERS: Record<string, 'workers' | 'anthropic' | 'openai'> = {
  // Workers AI models
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast': 'workers',
  '@cf/meta/llama-3.1-8b-instruct-awq': 'workers',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 'workers',
  '@cf/google/gemma-3-12b-it-fp8': 'workers',

  // Anthropic models
  'claude-haiku-4.5': 'anthropic',
  'claude-sonnet-4.5': 'anthropic',
  'claude-opus-4.6': 'anthropic',

  // OpenAI models
  'gpt-4o-mini': 'openai',
  'gpt-4o': 'openai',
};

/**
 * Get provider for a model
 */
export function getModelProvider(model: string): 'workers' | 'anthropic' | 'openai' {
  return MODEL_PROVIDERS[model] ?? 'workers';
}

/**
 * Check if a model is available for a given tier
 */
export function isModelAvailableForTier(model: string, tier: TenantTier): boolean {
  const plan = PLANS[tier];
  return plan.includedModels.includes(model);
}

/**
 * Default model by tier
 */
export const DEFAULT_MODELS: Record<TenantTier, string> = {
  starter: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  pro: '@cf/meta/llama-3.1-8b-instruct-awq',
  business: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  enterprise: 'claude-sonnet-4.5',
};

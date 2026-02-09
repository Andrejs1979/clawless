/**
 * LLM Provider Module
 * Exports all provider implementations and factory functions
 */

export * from './base';
export * from './workers-ai';
export * from './anthropic';
export * from './openai';
export * from './router';

import type { Env } from '@/index';

import { createAnthropicProvider } from './anthropic';
import type { CompletionOptions, CompletionResult, StreamChunk, ILLMProvider } from './base';
import { createOpenAIProvider } from './openai';
import { createWorkersAIProvider } from './workers-ai';

/**
 * Get an LLM provider instance by name
 */
export function getProvider(providerName: string): ILLMProvider {
  switch (providerName) {
    case 'workers':
      return createWorkersAIProvider();
    case 'anthropic':
      return createAnthropicProvider();
    case 'openai':
      return createOpenAIProvider();
    default:
      return createWorkersAIProvider();
  }
}

/**
 * Complete a chat request using the specified provider
 */
export async function complete(
  providerName: string,
  options: CompletionOptions,
  env: Env
): Promise<CompletionResult> {
  const provider = getProvider(providerName);
  return provider.complete(options, env);
}

/**
 * Stream a chat request using the specified provider
 */
export function stream(
  providerName: string,
  options: CompletionOptions,
  env: Env
): ReadableStream<StreamChunk> {
  const provider = getProvider(providerName);
  return provider.stream(options, env);
}

/**
 * Check if a provider is available
 */
export function isProviderAvailable(providerName: string, env: Env): boolean {
  const provider = getProvider(providerName);
  return provider.isAvailable(env);
}

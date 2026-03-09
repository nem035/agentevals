import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { configSchema } from './schema.js'
import { defaultConfig } from './defaults.js'
import type { EvaliteConfig } from '../types.js'

const CONFIG_FILES = [
  'agentevals.config.ts',
  'agentevals.config.mts',
  'agentevals.config.js',
  'agentevals.config.mjs',
]

export async function loadConfig(cwd: string = process.cwd()): Promise<EvaliteConfig> {
  // Find config file
  let configPath: string | null = null
  for (const file of CONFIG_FILES) {
    const fullPath = resolve(cwd, file)
    if (existsSync(fullPath)) {
      configPath = fullPath
      break
    }
  }

  if (!configPath) {
    // No config file, use defaults
    return { ...defaultConfig }
  }

  // Load the config file
  const configUrl = pathToFileURL(configPath).href
  const configModule = await import(configUrl)
  const rawConfig = configModule.default ?? configModule

  // Validate with Zod
  const parsed = configSchema.safeParse(rawConfig)
  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(`Invalid agentevals config:\n${errors}`)
  }

  // Merge with defaults
  return {
    ...defaultConfig,
    ...parsed.data,
  }
}

/**
 * Helper function for users to define their config with type safety
 */
export function defineConfig(config: EvaliteConfig): EvaliteConfig {
  return config
}

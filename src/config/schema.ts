import { z } from 'zod'

export const configSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  trials: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),
  parallel: z.boolean().optional(),
  maxConcurrency: z.number().int().positive().optional(),
  reporters: z.array(z.enum(['console', 'json'])).optional(),
  maxCost: z.number().positive().optional(),
})

export type ConfigSchema = z.infer<typeof configSchema>

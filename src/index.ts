// Core eval functions
export { evalite, test, it, describe } from './core/registry.js'

// Tool testing helpers
export { createMockExecutor, createSpyExecutor } from './tools.js'

// Expect & Graders
export { createExpect, Expect, ExpectationError, matchers } from './expect/index.js'
export { defineGrader, type GraderFn, type CustomGrader } from './graders/custom.js'

// Config
export { defineConfig, loadConfig } from './config/loader.js'
export { defaultConfig } from './config/defaults.js'

// Types
export type {
  // AI result types (compatible with AI SDK)
  AIResult,
  ToolCallInfo,
  ToolResultInfo,
  UsageInfo,
  StepInfo,

  // Eval types
  EvalTask,
  EvaliteOptions,
  EvaliteApi,
  EvaliteEach,
  EvalGroup,
  EvalContext,
  EvalFn,
  EvalCaseFn,
  EvalCaseName,
  EvalMetadata,

  // Grading
  GraderResult,
  JudgeOptions,

  // Result types
  TrialResult,
  TaskResult,
  TaskStatus,
  GroupResult,
  RunResult,

  // Config types
  EvaliteConfig,
} from './types.js'

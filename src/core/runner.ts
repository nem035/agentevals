import type {
  EvaliteConfig,
  EvalTask,
  EvalGroup,
  GraderResult,
  RunResult,
  GroupResult,
  TaskResult,
  TaskStatus,
  UsageInfo,
  TrialResult,
} from '../types.js'
import { createEvalContext } from './context.js'
import { ExpectationError } from '../expect/index.js'
import { mergeEvalOptions } from './options.js'

export interface RunnerOptions {
  config: EvaliteConfig
  onGroupStart?: (group: EvalGroup) => void
  onGroupEnd?: (group: EvalGroup, result: GroupResult) => void
  onTaskStart?: (task: EvalTask) => void
  onTaskEnd?: (task: EvalTask, result: TaskResult) => void
  maxCost?: number
}

interface CostTracker {
  totalCost: number
  exceeded: boolean
}

class EvalTimeoutError extends Error {
  constructor(taskName: string, timeoutMs: number) {
    super(`Eval "${taskName}" timed out after ${timeoutMs}ms`)
    this.name = 'EvalTimeoutError'
  }
}

async function runWithTimeout<T>(
  taskName: string,
  timeoutMs: number | undefined,
  fn: () => T | Promise<T>
): Promise<T> {
  if (!timeoutMs) {
    return await fn()
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new EvalTimeoutError(taskName, timeoutMs))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * Run a single task trial
 */
async function runTrial(
  task: EvalTask,
  groupOptions: EvalGroup['options'],
  _options: RunnerOptions,
  costTracker: CostTracker
): Promise<TrialResult> {
  const startTime = Date.now()
  const graderResults: GraderResult[] = []
  const resolvedOptions = mergeEvalOptions(groupOptions, task.options)

  // Create context with grader collection
  const context = createEvalContext(
    task.options ?? {},
    groupOptions,
    graderResults
  )

  let status: TaskStatus = 'passed'
  let error: string | undefined
  const usage: UsageInfo = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  let costUsd = 0

  try {
    // Check cost limit before running
    if (_options.maxCost && costTracker.totalCost >= _options.maxCost) {
      costTracker.exceeded = true
      return {
        status: 'skipped',
        duration: 0,
        graderResults: [],
        error: 'Cost limit exceeded',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costUsd: 0,
      }
    }

    // Run the eval function
    await runWithTimeout(
      task.name,
      resolvedOptions.timeout ?? _options.config.timeout,
      () => task.fn(context)
    )

    // Check if any grader failed
    const failed = graderResults.some((r) => !r.pass)
    status = failed ? 'failed' : 'passed'

    // Aggregate usage from grader results (for LLM judges)
    for (const r of graderResults) {
      if (r.usage) {
        usage.inputTokens = (usage.inputTokens ?? 0) + (r.usage.inputTokens ?? 0)
        usage.outputTokens = (usage.outputTokens ?? 0) + (r.usage.outputTokens ?? 0)
        usage.totalTokens = (usage.totalTokens ?? 0) + (r.usage.totalTokens ?? 0)
      }
      if (r.costUsd) {
        costUsd += r.costUsd
      }
    }
  } catch (err) {
    if (err instanceof ExpectationError) {
      status = 'failed'
      error = err.graderResult.reason
    } else {
      status = 'error'
      error = err instanceof Error ? err.message : String(err)
    }
  }

  const duration = Date.now() - startTime

  // Update cost tracker
  costTracker.totalCost += costUsd

  return {
    status,
    duration,
    graderResults,
    error,
    usage,
    costUsd,
  }
}

/**
 * Run all trials for a task
 */
async function runTask(
  task: EvalTask,
  groupOptions: EvalGroup['options'],
  options: RunnerOptions,
  costTracker: CostTracker
): Promise<TaskResult> {
  const { config } = options
  const trials = config.trials ?? 1
  const startTime = Date.now()
  const resolvedOptions = mergeEvalOptions(groupOptions, task.options)

  options.onTaskStart?.(task)

  const trialResults: TrialResult[] = []

  for (let i = 0; i < trials; i++) {
    if (costTracker.exceeded) {
      trialResults.push({
        status: 'skipped',
        duration: 0,
        graderResults: [],
        error: 'Cost limit exceeded',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costUsd: 0,
      })
      continue
    }

    const result = await runTrial(task, groupOptions, options, costTracker)
    trialResults.push(result)
  }

  // Determine overall status (pass@k logic)
  const anyPassed = trialResults.some((r) => r.status === 'passed')
  const allSkipped = trialResults.every((r) => r.status === 'skipped')
  const anyError = trialResults.some((r) => r.status === 'error')

  let status: TaskStatus
  if (allSkipped) {
    status = 'skipped'
  } else if (anyPassed) {
    status = 'passed'
  } else if (anyError) {
    status = 'error'
  } else {
    status = 'failed'
  }

  const duration = Date.now() - startTime

  const result: TaskResult = {
    name: task.name,
    group: task.group,
    file: task.file,
    tags: resolvedOptions.tags,
    description: resolvedOptions.description,
    metadata: resolvedOptions.metadata,
    status,
    trials: trialResults,
    duration,
  }

  options.onTaskEnd?.(task, result)

  return result
}

/**
 * Run all tasks in a group
 */
async function runGroup(
  group: EvalGroup,
  options: RunnerOptions,
  costTracker: CostTracker
): Promise<GroupResult> {
  const { config } = options
  const startTime = Date.now()

  options.onGroupStart?.(group)

  const taskResults: TaskResult[] = []

  if (config.parallel) {
    const concurrency = config.maxConcurrency ?? 5
    const chunks: EvalTask[][] = []

    for (let i = 0; i < group.tasks.length; i += concurrency) {
      chunks.push(group.tasks.slice(i, i + concurrency))
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map((task) => runTask(task, group.options, options, costTracker))
      )
      taskResults.push(...results)
    }
  } else {
    for (const task of group.tasks) {
      const result = await runTask(task, group.options, options, costTracker)
      taskResults.push(result)
    }
  }

  const duration = Date.now() - startTime

  const result: GroupResult = {
    name: group.name,
    tags: group.options.tags,
    description: group.options.description,
    metadata: group.options.metadata,
    tasks: taskResults,
    duration,
  }

  options.onGroupEnd?.(group, result)

  return result
}

/**
 * Run all groups and ungrouped tasks
 */
export async function runEvals(
  groups: EvalGroup[],
  ungroupedTasks: EvalTask[],
  options: RunnerOptions
): Promise<RunResult> {
  const startTime = Date.now()
  const costTracker: CostTracker = { totalCost: 0, exceeded: false }
  const maxCost = options.maxCost ?? options.config.maxCost

  const groupResults: GroupResult[] = []
  const ungroupedResults: TaskResult[] = []

  // Run grouped tasks
  for (const group of groups) {
    if (group.tasks.length === 0) {
      continue
    }

    const result = await runGroup(group, { ...options, maxCost }, costTracker)
    groupResults.push(result)
  }

  // Run ungrouped tasks (they get empty options since each task has its own)
  if (ungroupedTasks.length > 0) {
    const { config } = options

    if (config.parallel) {
      const concurrency = config.maxConcurrency ?? 5
      const chunks: EvalTask[][] = []

      for (let i = 0; i < ungroupedTasks.length; i += concurrency) {
        chunks.push(ungroupedTasks.slice(i, i + concurrency))
      }

      for (const chunk of chunks) {
        const results = await Promise.all(
          chunk.map((task) => runTask(task, {}, { ...options, maxCost }, costTracker))
        )
        ungroupedResults.push(...results)
      }
    } else {
      for (const task of ungroupedTasks) {
        const result = await runTask(task, {}, { ...options, maxCost }, costTracker)
        ungroupedResults.push(result)
      }
    }
  }

  // Aggregate results
  let total = 0
  let passed = 0
  let failed = 0
  let skipped = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUsd = 0

  const allTaskResults = [
    ...groupResults.flatMap((g) => g.tasks),
    ...ungroupedResults,
  ]

  for (const task of allTaskResults) {
    total++
    switch (task.status) {
      case 'passed':
        passed++
        break
      case 'failed':
      case 'error':
        failed++
        break
      case 'skipped':
        skipped++
        break
    }

    for (const trial of task.trials) {
      totalInputTokens += trial.usage.inputTokens ?? 0
      totalOutputTokens += trial.usage.outputTokens ?? 0
      totalCostUsd += trial.costUsd
    }
  }

  const duration = Date.now() - startTime

  return {
    success: failed === 0,
    groups: groupResults,
    ungrouped: ungroupedResults,
    summary: {
      total,
      passed,
      failed,
      skipped,
    },
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
    },
    costUsd: totalCostUsd,
    duration,
  }
}

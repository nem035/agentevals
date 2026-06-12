import type { EvaliteConfig, EvalTask, EvalGroup } from '../../types.js'
import type { Reporter } from '../reporter/types.js'
import { loadConfig } from '../../config/loader.js'
import { discoverEvalFiles } from '../../core/discovery.js'
import { loadEvalFiles } from '../../core/loader.js'
import { runEvals } from '../../core/runner.js'
import { createConsoleReporter } from '../reporter/console.js'
import { createJsonReporter } from '../reporter/json.js'

export interface RunOptions {
  config?: string
  grep?: string
  trials?: number
  maxCost?: number
  reporter?: 'console' | 'json'
  verbose?: boolean
  dryRun?: boolean
}

export async function runCommand(
  patterns: string[],
  options: RunOptions
): Promise<number> {
  const cwd = process.cwd()

  // Load config
  let config: EvaliteConfig
  try {
    config = await loadConfig(cwd)
  } catch (error) {
    console.error('Failed to load config:', error)
    return 1
  }

  // Override config with CLI options
  if (options.trials !== undefined) {
    config.trials = options.trials
  }
  if (options.maxCost !== undefined) {
    config.maxCost = options.maxCost
  }

  // Discover eval files
  let files: string[]
  if (patterns.length > 0) {
    files = await discoverEvalFiles({
      cwd,
      include: patterns.map((p) => (p.includes('*') ? p : `**/*${p}*`)),
      exclude: config.exclude,
    })
  } else {
    files = await discoverEvalFiles({
      cwd,
      include: config.include,
      exclude: config.exclude,
    })
  }

  if (files.length === 0) {
    console.log('No eval files found.')
    return 0
  }

  // Dry run - just show what would be executed
  if (options.dryRun) {
    console.log('Would run the following eval files:')
    for (const file of files) {
      console.log(`  - ${file}`)
    }
    return 0
  }

  // Load eval files
  let tasks: EvalTask[]
  let groups: EvalGroup[]
  try {
    const loaded = await loadEvalFiles(files)
    tasks = loaded.tasks
    groups = loaded.groups
  } catch (error) {
    console.error('Failed to load eval files:', error)
    return 1
  }

  if (options.grep) {
    const filtered = filterEvalsByPattern(tasks, groups, options.grep)
    tasks = filtered.tasks
    groups = filtered.groups
  }

  if (tasks.length === 0) {
    console.log('No evals found in the discovered files.')
    return 0
  }

  // Separate ungrouped tasks (tasks not belonging to any group)
  const ungroupedTasks = tasks.filter((t) => !t.group)

  // Create reporter
  const reporterType = options.reporter ?? config.reporters?.[0] ?? 'console'
  const reporter: Reporter =
    reporterType === 'json'
      ? createJsonReporter({ pretty: true })
      : createConsoleReporter({ verbose: options.verbose })

  // Run evals
  reporter.onStart?.()

  const result = await runEvals(groups, ungroupedTasks, {
    config,
    maxCost: options.maxCost,
    onGroupStart: reporter.onGroupStart?.bind(reporter),
    onGroupEnd: reporter.onGroupEnd?.bind(reporter),
    onTaskStart: reporter.onTaskStart?.bind(reporter),
    onTaskEnd: reporter.onTaskEnd?.bind(reporter),
  })

  reporter.onEnd?.(result)

  return result.success ? 0 : 1
}

export function filterEvalsByPattern(
  tasks: EvalTask[],
  groups: EvalGroup[],
  pattern: string
): { tasks: EvalTask[]; groups: EvalGroup[] } {
  const regex = new RegExp(pattern, 'i')

  const filteredGroups = groups
    .map((group) => {
      const groupMatches = matchesGroup(group, regex)
      return {
        ...group,
        tasks: groupMatches
          ? group.tasks
          : group.tasks.filter((task) => matchesTask(task, regex)),
      }
    })
    .filter((group) => group.tasks.length > 0)

  const filteredUngroupedTasks = tasks.filter(
    (task) => !task.group && matchesTask(task, regex)
  )

  return {
    tasks: [...filteredGroups.flatMap((group) => group.tasks), ...filteredUngroupedTasks],
    groups: filteredGroups,
  }
}

function matchesGroup(group: EvalGroup, regex: RegExp): boolean {
  return matchesAny(regex, [
    group.name,
    group.options.description,
    ...(group.options.tags ?? []),
    metadataToText(group.options.metadata),
  ])
}

function matchesTask(task: EvalTask, regex: RegExp): boolean {
  return matchesAny(regex, [
    task.name,
    task.group,
    task.file,
    task.options.description,
    ...(task.options.tags ?? []),
    metadataToText(task.options.metadata),
  ])
}

function matchesAny(regex: RegExp, values: Array<string | undefined>): boolean {
  return values.some((value) => value !== undefined && regex.test(value))
}

function metadataToText(metadata: EvalTask['options']['metadata']): string | undefined {
  return metadata ? JSON.stringify(metadata) : undefined
}

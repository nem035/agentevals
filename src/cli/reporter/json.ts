import type { RunResult, TaskResult } from '../../types.js'
import type { Reporter } from './types.js'

export interface JsonReporterOptions {
  pretty?: boolean
}

export function createJsonReporter(options: JsonReporterOptions = {}): Reporter {
  const { pretty = false } = options

  return {
    onEnd(result: RunResult): void {
      const output = {
        success: result.success,
        summary: result.summary,
        groups: result.groups.map((group) => ({
          name: group.name,
          tags: group.tags,
          description: group.description,
          metadata: group.metadata,
          tasks: group.tasks.map((task) => ({
            ...formatTask(task),
          })),
          duration: group.duration,
        })),
        ungrouped: result.ungrouped.map((task) => ({
          ...formatTask(task),
        })),
        usage: result.usage,
        costUsd: result.costUsd,
        duration: result.duration,
      }

      if (pretty) {
        console.log(JSON.stringify(output, null, 2))
      } else {
        console.log(JSON.stringify(output))
      }
    },
  }
}

function formatTask(task: TaskResult) {
  return {
    name: task.name,
    group: task.group,
    file: task.file,
    tags: task.tags,
    description: task.description,
    metadata: task.metadata,
    status: task.status,
    duration: task.duration,
    trials: task.trials.map((trial) => ({
      status: trial.status,
      duration: trial.duration,
      error: trial.error,
      graders: trial.graderResults.map((g) => ({
        pass: g.pass,
        reason: g.reason,
        score: g.score,
      })),
      usage: trial.usage,
      costUsd: trial.costUsd,
    })),
  }
}

import type { RunResult, GroupResult, TaskResult, EvalTask, EvalGroup } from '../../types.js'

export interface Reporter {
  onStart?(): void
  onGroupStart?(group: EvalGroup): void
  onGroupEnd?(group: EvalGroup, result: GroupResult): void
  onTaskStart?(task: EvalTask): void
  onTaskEnd?(task: EvalTask, result: TaskResult): void
  onEnd?(result: RunResult): void
}

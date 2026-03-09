import { pathToFileURL } from 'node:url'
import type { EvalTask, EvalGroup } from '../types.js'
import {
  resetRegistry,
  setCurrentFile,
  getCollectedTasks,
  getCollectedGroups,
} from './registry.js'

/**
 * Load eval files and collect their tasks and groups
 */
export async function loadEvalFiles(
  files: string[]
): Promise<{ tasks: EvalTask[]; groups: EvalGroup[] }> {
  const allTasks: EvalTask[] = []
  const allGroups: EvalGroup[] = []

  for (const file of files) {
    resetRegistry()
    setCurrentFile(file)

    // Import the file - this will execute evalite() / evalite.group() calls
    // which populate the registry
    const fileUrl = pathToFileURL(file).href
    await import(fileUrl)

    allTasks.push(...getCollectedTasks())
    allGroups.push(...getCollectedGroups())
  }

  resetRegistry()
  return { tasks: allTasks, groups: allGroups }
}

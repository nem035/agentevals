import { describe, it, expect, beforeEach } from 'vitest'
import {
  evalite,
  resetRegistry,
  setCurrentFile,
  getCollectedTasks,
  getCollectedGroups,
} from './registry.js'

describe('registry', () => {
  beforeEach(() => {
    resetRegistry()
  })

  describe('evalite()', () => {
    it('registers a task with name and function', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite('my-task', async () => {})

      const tasks = getCollectedTasks()
      expect(tasks).toHaveLength(1)
      expect(tasks[0].name).toBe('my-task')
    })

    it('registers a task with options', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite('my-task', { timeout: 5000 }, async () => {})

      const tasks = getCollectedTasks()
      expect(tasks).toHaveLength(1)
      expect(tasks[0].options.timeout).toBe(5000)
    })

    it('collects multiple tasks', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite('task-1', async () => {})
      evalite('task-2', async () => {})
      evalite('task-3', async () => {})

      const tasks = getCollectedTasks()
      expect(tasks).toHaveLength(3)
    })

    it('ungrouped tasks have no group property', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite('standalone-task', async () => {})

      const tasks = getCollectedTasks()
      expect(tasks[0].group).toBeUndefined()
    })
  })

  describe('evalite.group()', () => {
    it('creates a group with name and collects tasks', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite.group('my-group', () => {
        evalite('grouped-task', async () => {})
      })

      const groups = getCollectedGroups()
      expect(groups).toHaveLength(1)
      expect(groups[0].name).toBe('my-group')
      expect(groups[0].tasks).toHaveLength(1)
      expect(groups[0].tasks[0].name).toBe('grouped-task')
    })

    it('creates a group with options', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite.group('my-group', { timeout: 10000 }, () => {
        evalite('task', async () => {})
      })

      const groups = getCollectedGroups()
      expect(groups[0].options.timeout).toBe(10000)
    })

    it('grouped tasks have group property set', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite.group('my-group', () => {
        evalite('grouped-task', async () => {})
      })

      const tasks = getCollectedTasks()
      expect(tasks[0].group).toBe('my-group')
    })

    it('collects multiple groups', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite.group('group-1', () => {
        evalite('task-1', async () => {})
      })
      evalite.group('group-2', () => {
        evalite('task-2', async () => {})
      })

      const groups = getCollectedGroups()
      expect(groups).toHaveLength(2)
    })
  })

  describe('resetRegistry()', () => {
    it('clears all collected tasks and groups', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite('task-1', async () => {})
      evalite.group('group-1', () => {
        evalite('task-2', async () => {})
      })

      expect(getCollectedTasks()).toHaveLength(2)
      expect(getCollectedGroups()).toHaveLength(1)

      resetRegistry()

      expect(getCollectedTasks()).toHaveLength(0)
      expect(getCollectedGroups()).toHaveLength(0)
    })
  })
})

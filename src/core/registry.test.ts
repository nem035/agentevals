import { describe, it, expect, beforeEach } from 'vitest'
import {
  evalite,
  describe as evaliteDescribe,
  resetRegistry,
  setCurrentFile,
  getCollectedTasks,
  getCollectedGroups,
} from './registry.js'
import { createExpect } from '../expect/index.js'

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

    it('records the source file for tasks', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite('task-with-file', async () => {})

      expect(getCollectedTasks()[0].file).toBe('/test/file.eval.ts')
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

    it('supports nested groups with inherited names and options', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite.group('outer', { tags: ['outer'] }, () => {
        evalite.group('inner', { tags: ['inner'] }, () => {
          evalite('nested-task', async () => {})
        })
        evalite('outer-task', async () => {})
      })

      const groups = getCollectedGroups()
      expect(groups.map((group) => group.name)).toEqual(['outer', 'outer > inner'])
      expect(groups[0].tasks[0].name).toBe('outer-task')
      expect(groups[1].tasks[0].name).toBe('nested-task')
      expect(groups[1].options.tags).toEqual(['outer', 'inner'])
    })

    it('exports describe as a group alias', () => {
      setCurrentFile('/test/file.eval.ts')

      evaliteDescribe('aliased-group', () => {
        evalite('task', async () => {})
      })

      expect(getCollectedGroups()[0].name).toBe('aliased-group')
    })
  })

  describe('evalite.each()', () => {
    it('registers one task per case with interpolated names', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite.each([
        { label: 'first', expected: 1 },
        { label: 'second', expected: 2 },
      ])('case $#: $label', async () => {})

      expect(getCollectedTasks().map((task) => task.name)).toEqual([
        'case 0: first',
        'case 1: second',
      ])
    })

    it('passes each case into the callback', async () => {
      setCurrentFile('/test/file.eval.ts')

      evalite.each([{ value: 42 }])('uses case', async (testCase, { expect: assert }) => {
        assert({
          text: String(testCase.value),
          toolCalls: [],
          toolResults: [],
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          steps: [],
        }).toContain('42')
      })

      const task = getCollectedTasks()[0]
      await task.fn({
        expect: (result) => createExpect(result, []),
      })
    })

    it('supports function-based case names and shared options', () => {
      setCurrentFile('/test/file.eval.ts')

      evalite.each([{ label: 'alpha' }])(
        (testCase) => `generated ${testCase.label}`,
        { timeout: 1234, tags: ['table'] },
        async () => {}
      )

      const task = getCollectedTasks()[0]
      expect(task.name).toBe('generated alpha')
      expect(task.options.timeout).toBe(1234)
      expect(task.options.tags).toEqual(['table'])
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

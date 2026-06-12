import { describe, expect, it } from 'vitest'
import { filterEvalsByPattern } from './run.js'
import type { EvalGroup, EvalTask } from '../../types.js'

const noop = async () => {}

function task(overrides: Partial<EvalTask>): EvalTask {
  return {
    name: 'default-task',
    fn: noop,
    options: {},
    ...overrides,
  }
}

describe('filterEvalsByPattern', () => {
  it('filters ungrouped tasks by name', () => {
    const tasks = [
      task({ name: 'answers greeting' }),
      task({ name: 'solves math' }),
    ]

    const result = filterEvalsByPattern(tasks, [], 'greeting')

    expect(result.tasks.map((item) => item.name)).toEqual(['answers greeting'])
    expect(result.groups).toEqual([])
  })

  it('filters grouped tasks by task metadata', () => {
    const groupedTask = task({
      name: 'handles support',
      group: 'student-support',
      options: { tags: ['positive'] },
    })
    const group: EvalGroup = {
      name: 'student-support',
      options: {},
      tasks: [groupedTask, task({ name: 'academic discussion', group: 'student-support' })],
    }

    const result = filterEvalsByPattern([groupedTask], [group], 'positive')

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].tasks.map((item) => item.name)).toEqual(['handles support'])
    expect(result.tasks.map((item) => item.name)).toEqual(['handles support'])
  })

  it('includes all group tasks when the group matches', () => {
    const group: EvalGroup = {
      name: 'content-fidelity',
      options: { tags: ['tools'] },
      tasks: [
        task({ name: 'preserves names', group: 'content-fidelity' }),
        task({ name: 'preserves numbers', group: 'content-fidelity' }),
      ],
    }

    const result = filterEvalsByPattern(group.tasks, [group], 'tools')

    expect(result.groups[0].tasks.map((item) => item.name)).toEqual([
      'preserves names',
      'preserves numbers',
    ])
  })

  it('matches task descriptions and metadata', () => {
    const tasks = [
      task({
        name: 'regression fixture',
        options: {
          description: 'Reproduces prod chat 123',
          metadata: { issue: '4003' },
        },
      }),
    ]

    expect(filterEvalsByPattern(tasks, [], 'prod chat').tasks).toHaveLength(1)
    expect(filterEvalsByPattern(tasks, [], '4003').tasks).toHaveLength(1)
  })
})

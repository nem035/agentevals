// A tool-calling support agent: does it reach for the right tool with the right arguments?
import { defineEval, grader, noToolCalls, toolCallsOf } from '@nem035/agentevals'
import { chance, sdkResult } from './fake-model.js'

type Input = { message: string }
type Expected = { tool: string; args?: Record<string, string> } | { tool: null }

// In a real project this is your agent, e.g. `import { supportAgent } from '../src/agent'`.
// It returns what `generateText` returns, and agentevals reads the tool calls from it.
async function supportAgent({ message }: Input, { trial, caseId }: { trial: number; caseId: string }) {
  const orderId = message.match(/#(\w+)/)?.[1]
  if (/where|track|arriv/i.test(message) && orderId) return sdkResult('Let me check.', [{ toolName: 'lookupOrder', input: { orderId } }])
  if (/refund|money back/i.test(message)) {
    // Flaky on purpose: sometimes it forgets the order id.
    const input = chance(`refund:${caseId}:${trial}`, 0.4) ? {} : { orderId }
    return sdkResult('I can help with that.', [{ toolName: 'startRefund', input }])
  }
  return sdkResult('Happy to help! What do you need?')
}

const calledExpectedTool = grader<unknown, { id: string; input: Input; expected?: Expected }>('calledExpectedTool', (output, c) => {
  const want = c.expected!
  const calls = toolCallsOf(output)
  if (want.tool === null) return noToolCalls().grade(output, c, {})
  const call = calls.find((t) => t.toolName === want.tool)
  if (!call) return { pass: false, reason: `wanted ${want.tool}, got ${calls.map((t) => t.toolName).join(', ') || 'no tools'}` }
  for (const [k, v] of Object.entries(want.args ?? {})) {
    if ((call.input as Record<string, unknown>)?.[k] !== v) return { pass: false, reason: `${want.tool} got ${k}=${JSON.stringify((call.input as any)?.[k])}` }
  }
  return true
})

export default defineEval<Input, unknown, Expected>({
  name: 'support agent tools',
  cases: [
    { id: 'track-order', input: { message: 'Where is my order #A1001?' }, expected: { tool: 'lookupOrder', args: { orderId: 'A1001' } } },
    { id: 'track-arriving', input: { message: 'When is #A2002 arriving?' }, expected: { tool: 'lookupOrder', args: { orderId: 'A2002' } } },
    { id: 'refund', input: { message: 'I want a refund for #A3003' }, expected: { tool: 'startRefund', args: { orderId: 'A3003' } } },
    { id: 'refund-money-back', input: { message: 'Can I get my money back on #A4004?' }, expected: { tool: 'startRefund', args: { orderId: 'A4004' } } },
    { id: 'track-no-id', input: { message: 'Where is my package?' }, expected: { tool: 'lookupOrder' }, tags: ['missing-id'] },
    { id: 'small-talk', input: { message: 'Thanks, you were great!' }, expected: { tool: null } },
  ],
  task: supportAgent,
  graders: [calledExpectedTool],
  trials: 3,
})

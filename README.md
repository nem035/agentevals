# agentevals

Evals you can trust. Run your real code on a set of cases, grade each output, and get a score that says how much it can move, a list of trials that broke instead of quietly counting them as failures, and a luck check that tells you whether a change really helped.

```bash
npm install -D @nem035/agentevals
npx agentevals init
npx agentevals run
```

```
 date extraction (baseline)
   Score    80%  give or take 30 points  over 5 cases
   Broken   none
   Failures
     ✕ end-of-next-week  sameDay  got "unknown", expected "2026-10-30"
   Saved    .agentevals/runs/date-extraction/2026-11-04T01-37-13-777Z--baseline.json
```

It works with any model client. Your task is a plain function, and the judge is a function from prompt to text. No API key is needed to try it.

The practices behind it are explained in [How to Build an LLM Eval You Can Trust, Step by Step](https://nem035.com/thoughts/how-to-build-an-llm-eval-you-can-trust).

## An eval

```ts
// evals/dates.eval.ts
import { defineEval, grader } from '@nem035/agentevals'
import { extractDate } from '../src/extract' // your production code path

export default defineEval({
  name: 'date extraction',
  cases: './dates.cases.jsonl', // { id, input, expected?, tags? } per line
  task: (input) => extractDate(input.email, input.sentOn),
  graders: [grader('sameDay', (output, c) => output === c.expected)],
  trials: 3,
  holdout: 0.3,
})
```

Three things, and each one is a plain value you can build however you like:

| | What it is |
|---|---|
| `cases` | An array, or a path to `.json` / `.jsonl`. Every case needs a stable `id`, because runs are compared case by case. |
| `task` | Your code under test, `(input, { signal, trial, caseId }) => output`. Call the same function production calls. |
| `graders` | Checks on the output. Each returns `true`, `false`, or `{ pass, reason }`. |

## What a run tells you

**A score with its range.** "80%, give or take 30 points over 5 cases" means another set of cases like these could easily land anywhere from 50% to 100%. Add cases to narrow it. Each case counts once, so three trials of one case never weigh like three cases.

**Broken trials, kept out of the score.** A trial that timed out, threw, got cut off at the output limit, or whose grader crashed did not measure the model. It is listed by reason and not scored. If more than 5% of trials broke, the run fails, because the score is then partly about your setup. If the model itself produced something wrong (bad JSON, a refusal), throw `fail('reason')` so it counts as a real failure.

**Flaky cases.** With `trials: 3`, each case gets a pass rate. Cases that passed some trials and failed others are listed by name.

**Train and test.** `holdout: 0.3` sets aside about 30% of cases by a hash of their id, so the split never changes. The report names the train failures and only counts the test failures, so you fix prompts against cases you read and check them on cases you didn't.

## Did the change help?

Label runs and compare them:

```bash
npx agentevals run -l before
# edit the prompt
npx agentevals run -l after
npx agentevals compare            # newest run vs. the one before it
```

```
   Only A passed 2   only B passed 7   (both passed 61, both failed 10)
   Gap +5 from 9 disagreements. Chance alone gives a gap this big 18% of the time.
   Could easily be luck. Run more trials or add cases before believing it.

   Only B passed refund-partial, refund-no-id, ...
```

Cases both runs agree on can't explain the difference, so only the disagreements are counted. If the change did nothing, each disagreement is a coin toss between A and B. The chance is how often coin tosses alone give a gap at least this big. Under 5%, it's probably real. With several trials, each case counts by its majority.

To compare prompts or models in one run, use `variants` instead of `task`. The first is the baseline and the rest are compared against it:

```ts
defineEval({
  name: 'review sentiment',
  cases,
  variants: {
    'zero-shot prompt': (input) => classify(input, ZERO_SHOT),
    'prompt with examples': (input) => classify(input, FEW_SHOT),
  },
  graders: [equals()],
  trials: 3,
})
```

## Graders

```ts
import { grader, equals, includes, matches, toolCalled, noToolCalls, schema, not, judge } from '@nem035/agentevals'

equals()                                         // deep-equals case.expected
equals((c) => c.expected.total, 'sameTotal')     // or something derived from the case
includes('refund')                               // output text, case-insensitive
matches(/\d{4}-\d{2}-\d{2}/)
toolCalled('lookupOrder', { input: { orderId: /^A\d+$/ } })
noToolCalls()
schema(InvoiceSchema)                            // anything with safeParse (Zod, ...)
not(toolCalled('deleteAccount'), 'didNotDelete')
grader('sameDay', (out, c) => sameDay(parse(out), parse(c.expected)))
```

Name a grader after what it actually checks. The name is what people read in a failure, and a text comparison called `wrongDate` turns into "the model gets dates wrong" in someone's head.

Outputs from the AI SDK's `generateText` are read as they are: the graders find `text` and every step's tool calls. Other values are stored as JSON.

### Judges

```ts
import { judge, aiSdkJudge, defineConfig } from '@nem035/agentevals'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

// agentevals.config.ts: the judge is set apart from the model you test
export default defineConfig({
  judgeModel: aiSdkJudge({ generateText, model: anthropic('claude-haiku-4-5') }),
})

// in an eval
graders: [judge('Does the reply name the mistake the user made? Quote where it does.', { name: 'namesTheMistake' })]
```

A judge answers one question you could check yourself, not "rate it 1 to 10". It must quote the output for a pass, and every quote is checked against the output. A quote that isn't there makes the trial broken, not failed, since the grader is what went wrong.

`judgeModel` is any `(prompt: string) => Promise<string>`, so any client works.

Two commands keep judges honest:

```bash
npx agentevals check-judge     # grade saved outputs twice, list verdicts that flipped
npx agentevals regrade         # rerun only the graders on saved outputs, then compare
```

A flip points at a line in the instructions two readers could read differently. `regrade` is how you test a grader change: the outputs stay the same, so any change in the score comes from the grader.

## Gates

```ts
defineEval({
  name: 'never deletes without confirmation',
  cases,
  task: accountAgent,
  graders: [not(toolCalled('deleteAccount'), 'didNotDeleteAccount')],
  gate: true,
  trials: 5,
})
```

A gate is for behavior that must hold every time: one failed trial fails the run. Use a scored eval for "how good is it" and a gate for "never do this".

## CLI

```
agentevals run [files or folders...]   run and save every run
  -l, --label <name>     name the run to compare it later
  -t, --trials <n>       trials per case
  -c, --concurrency <n>  trials at once (default 5)
  -s, --split <split>    train or test only
  -g, --grep <text>      evals or cases by name, id or tag
      --json             JSON instead of the report
      --no-save
agentevals compare [a] [b]      by file, label or variant (default: the last two runs)
agentevals regrade [run]
agentevals check-judge [run] [--times n]
agentevals init
```

`run` exits with 1 when a run fails: too many broken trials, a failed gate, or a score below `minScore`. Runs are saved in `.agentevals/runs`, so add that to `.gitignore` or keep it to track history.

## Config

```ts
// agentevals.config.ts
import { defineConfig } from '@nem035/agentevals'

export default defineConfig({
  include: ['evals/**/*.eval.ts'],
  concurrency: 5,
  trials: 1,          // per eval unless the eval sets its own
  timeoutMs: 60_000,  // a timed-out trial is broken, not failed
  maxBroken: 0.05,
  judgeModel,
})
```

## In code

Everything the CLI does is a function you can call, in a test runner, a script or CI:

```ts
import { runEval, summarize, compareRuns, saveRun } from '@nem035/agentevals'

const [before, after] = await runEval(myEval) // one run per variant
const { all } = compareRuns(before, after)
if (!all.probablyReal) console.log(`Gap ${all.gap} could be luck (${Math.round(all.chance * 100)}%)`)
console.log(summarize(after).all) // { cases, score, low, high, flaky }
```

The stats are exported too: `luckCheck(onlyA, onlyB)`, `scoreRange(passRates)`, and `splitOf(id, holdout)`.

## Examples

[`examples/`](examples) runs offline with a stand-in model:

- `support-agent.eval.ts` checks which tool an agent calls and with what arguments
- `prompts.eval.ts` compares two prompts with `variants`
- `judge.eval.ts` uses a model-graded check with quotes
- `safety.eval.ts` is a gate

```bash
npx agentevals run examples
```

## License

MIT

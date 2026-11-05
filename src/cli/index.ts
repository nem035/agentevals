import { existsSync } from 'node:fs'
import { relative } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { Command } from 'commander'
import pc from 'picocolors'
import { runEval } from '../run.js'
import { summarize } from '../summary.js'
import { compareRuns } from '../compare.js'
import { regradeRun, checkJudge } from '../regrade.js'
import { DEFAULT_OUT_DIR, findRun, listRuns, saveRun } from '../store.js'
import { formatComparison, formatJudgeCheck, formatRun } from '../report.js'
import type { Config, RunRecord, Split } from '../types.js'
import { baseDirOf, findEvalFiles, loadConfig, loadEvals } from './load.js'
import { INIT_CASES, INIT_CONFIG, INIT_EVAL } from './init.js'

const program = new Command()
program.name('agentevals').description('Evals you can trust').version('1.0.0')

program
  .command('run')
  .description('Run evals, save every run, and report scores with their range')
  .argument('[files...]', 'eval files or globs (default: config include, or **/*.eval.ts)')
  .option('-l, --label <label>', 'name this run, e.g. "new-prompt", to compare it later')
  .option('-t, --trials <n>', 'trials per case', toInt)
  .option('-c, --concurrency <n>', 'trials running at once', toInt)
  .option('-s, --split <split>', 'run only the "train" or "test" cases', 'all')
  .option('-g, --grep <text>', 'only evals or cases whose name, id or tags contain this text')
  .option('--json', 'print JSON instead of the report')
  .option('--no-save', 'do not save the run')
  .action(async (files: string[], o) => {
    const config = await loadConfig()
    const evals = await loadEvals(await findEvalFiles(files, config))
    if (!evals.length) return fail('No evals found. Create one with `agentevals init`.')
    const grep = (o.grep as string | undefined)?.toLowerCase()
    const outDir = config.outDir ?? DEFAULT_OUT_DIR
    let ok = true
    const json: unknown[] = []
    for (const { def, file } of evals) {
      const nameMatches = !grep || def.name.toLowerCase().includes(grep)
      const runs = await runEval(def, {
        label: o.label,
        trials: o.trials,
        concurrency: o.concurrency ?? config.concurrency,
        split: o.split as Split | 'all',
        filter: nameMatches ? undefined : (c) => c.id.toLowerCase().includes(grep!) || !!c.tags?.some((t) => t.toLowerCase().includes(grep!)),
        judgeModel: config.judgeModel,
        defaults: { timeoutMs: config.timeoutMs, maxBroken: config.maxBroken, trials: config.trials },
        baseDir: baseDirOf(file),
        onTrial: progress(),
      })
      clearProgress()
      for (const run of runs) {
        if (!run.cases.length) continue
        const summary = summarize(run)
        ok &&= summary.ok
        const saved = o.save ? await saveRun(run, outDir) : undefined
        if (o.json) json.push({ summary, saved })
        else console.log(formatRun(run, summary) + (saved ? pc.dim(`\n   Saved    ${relative(process.cwd(), saved)}`) : ''))
      }
      if (runs.length > 1 && !o.json) {
        for (const other of runs.slice(1)) console.log(formatComparison(compareRuns(runs[0], other)))
      }
    }
    if (o.json) console.log(JSON.stringify(json, null, 2))
    console.log('')
    process.exitCode = ok ? 0 : 1
  })

program
  .command('compare')
  .description('Compare two saved runs case by case, with the luck check')
  .argument('[a]', 'run A: file, label or variant (default: the run before B)')
  .argument('[b]', 'run B: file, label or variant (default: the newest run)')
  .option('-e, --eval <name>', 'only runs of this eval')
  .option('--json', 'print JSON')
  .action(async (aRef: string | undefined, bRef: string | undefined, o) => {
    const config = await loadConfig()
    const outDir = config.outDir ?? DEFAULT_OUT_DIR
    const b = await findRun(bRef, outDir, o.eval)
    let a
    if (aRef) a = await findRun(aRef, outDir, o.eval ?? b.run.eval)
    else {
      const earlier = (await listRuns(outDir)).filter(
        (r) => r.run.eval === b.run.eval && r.run.variant === b.run.variant && r.run.startedAt < b.run.startedAt,
      )
      a = earlier.at(-1)
      if (!a) return fail(`Only one saved run of "${b.run.eval}". Run it again, or name two runs.`)
    }
    const cmp = compareRuns(a.run, b.run)
    console.log(o.json ? JSON.stringify(cmp, null, 2) : formatComparison(cmp) + '\n')
  })

program
  .command('regrade')
  .description("Rerun only the graders on a saved run's outputs")
  .argument('[run]', 'file, label or variant (default: newest run)')
  .action(async (ref: string | undefined) => {
    const config = await loadConfig()
    const outDir = config.outDir ?? DEFAULT_OUT_DIR
    const saved = await findRun(ref, outDir)
    const def = await evalNamed(saved.run.eval, config)
    const regraded = await regradeRun(saved.run, def, config.judgeModel)
    const path = await saveRun(regraded, outDir)
    console.log(formatRun(regraded, summarize(regraded)) + pc.dim(`\n   Saved    ${relative(process.cwd(), path)}`))
    console.log(formatComparison(compareRuns(saved.run, regraded)) + '\n')
  })

program
  .command('check-judge')
  .description('Grade saved outputs again with each judge and list verdicts that changed')
  .argument('[run]', 'file, label or variant (default: newest run)')
  .option('--times <n>', 'gradings per output', toInt, 2)
  .action(async (ref: string | undefined, o) => {
    const config = await loadConfig()
    const saved = await findRun(ref, config.outDir ?? DEFAULT_OUT_DIR)
    const def = await evalNamed(saved.run.eval, config)
    if (!def.graders.some((g) => g.kind === 'judge')) return fail(`"${def.name}" has no judge graders`)
    console.log(formatJudgeCheck(await checkJudge(saved.run, def, { judgeModel: config.judgeModel, times: o.times })) + '\n')
  })

program
  .command('init')
  .description('Create agentevals.config.ts and an example eval')
  .action(async () => {
    const files: [string, string][] = [
      ['agentevals.config.ts', INIT_CONFIG],
      ['evals/dates.eval.ts', INIT_EVAL],
      ['evals/dates.cases.jsonl', INIT_CASES],
    ]
    await mkdir('evals', { recursive: true })
    for (const [path, body] of files) {
      if (existsSync(path)) console.log(pc.dim(`  exists   ${path}`))
      else {
        await writeFile(path, body)
        console.log(`  created  ${path}`)
      }
    }
    console.log(`\n  Next: ${pc.bold('npx agentevals run')}\n`)
  })

async function evalNamed(name: string, config: Config) {
  const evals = await loadEvals(await findEvalFiles(undefined, config))
  const hit = evals.find((e) => e.def.name === name)
  if (!hit) throw new Error(`No eval named "${name}" in this project`)
  return hit.def
}

function toInt(v: string): number {
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n) || n < 1) throw new Error(`Expected a positive number, got "${v}"`)
  return n
}

function progress() {
  let n = 0
  return (e: { trial: RunRecord['cases'][number]['trials'][number] }) => {
    n++
    if (!process.stderr.isTTY) return
    const mark = e.trial.status === 'pass' ? pc.green('.') : e.trial.status === 'fail' ? pc.red('x') : pc.yellow('b')
    process.stderr.write(n === 1 ? `   ${mark}` : mark)
  }
}

function clearProgress() {
  if (process.stderr.isTTY) process.stderr.write('\r\x1b[2K')
}

function fail(message: string): void {
  console.error(pc.red(message))
  process.exitCode = 1
}

program.parseAsync().catch((err) => {
  console.error(pc.red(err instanceof Error ? err.message : String(err)))
  process.exitCode = 1
})

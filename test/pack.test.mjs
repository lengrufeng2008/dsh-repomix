import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packRepo } from '../src/pack.mjs'
import { apply } from '../plugin/index.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DEMO = join(ROOT, 'test/fixtures/demo')

test('XML pack includes text files and excludes binaries, dependencies, and secrets', async () => {
  const report = await packRepo(DEMO)
  assert.equal(report.files, 2)
  assert.match(report.content, /a\.js/)
  assert.match(report.content, /sub\/b\.md/)
  assert.doesNotMatch(report.content, /logo\.png/)
  assert.doesNotMatch(report.content, /node_modules/)
  assert.equal(report.truncated, false)
  assert.ok(report.tokens > 0)
})

test('Markdown pack and truncation are explicit', async () => {
  const md = await packRepo(DEMO, { format: 'markdown' })
  assert.match(md.content, /## File: `a\.js`/)
  const small = await packRepo(DEMO, { maxTotalBytes: 20 })
  assert.equal(small.truncated, true)
  assert.ok(small.files <= 1)
})

test('the CLI writes a pack and reports the estimate', () => {
  const out = join(ROOT, 'test/fixtures/demo', 'pack.out')
  const result = spawnSync(process.execPath, [join(ROOT, 'bin/dsh-repomix.mjs'), DEMO, '--output', out], { encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /files, .* bytes/)
  const read = spawnSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(out)},'utf8'))`], { encoding: 'utf8' })
  assert.match(read.stdout, /<repository/)
  spawnSync(process.execPath, ['-e', `require('fs').unlinkSync(${JSON.stringify(out)})`])
})

test('the plugin registers repo_pack and repo-pack', async () => {
  const tools = []
  let factory
  apply({ tools: { register: (tool) => tools.push(tool) }, skills: { registerProvider: (fn) => { factory = fn } } })
  assert.equal(tools[0].name, 'repo_pack')
  const result = await tools[0].execute({ path: DEMO })
  assert.equal(result.files, 2)
  const provider = factory()
  assert.equal((await provider.list())[0].name, 'repo-pack')
  assert.match((await provider.get({ name: 'repo-pack' })).content, /repo_pack/)
  assert.equal(await provider.get({ name: 'missing' }), undefined)
})

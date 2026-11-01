#!/usr/bin/env node
import { writeFile } from 'node:fs/promises'
import { packRepo } from '../src/pack.mjs'
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log('dsh-repomix [dir] [--format xml|markdown] [--output FILE] [--max-file BYTES] [--max-total BYTES]\n\nPack a repository into one bounded context document.')
  process.exit(0)
}
function value(name, fallback) { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1] }
let target = '.'
const withValue = new Set(['--format', '--output', '--max-file', '--max-total'])
for (let i = 0; i < args.length; i += 1) {
  if (args[i].startsWith('--')) { if (withValue.has(args[i])) i += 1; continue }
  target = args[i]; break
}
const format = value('--format', 'xml')
try {
  const report = await packRepo(target, { format, maxFileBytes: Number(value('--max-file', 200 * 1024)), maxTotalBytes: Number(value('--max-total', 1024 * 1024)) })
  const out = value('--output')
  if (out) { await writeFile(out, report.content); console.log(`wrote ${out}: ${report.files} files, ${report.bytes} bytes, ~${report.tokens} tokens${report.truncated ? ' (truncated)' : ''}`) }
  else process.stdout.write(report.content + '\n')
  process.exitCode = 0
} catch (error) { console.error(`dsh-repomix: ${error.message}`); process.exitCode = 2 }

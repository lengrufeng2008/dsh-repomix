// DSH host plugin: a bounded, read-only repository packer for context handoff.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packRepo } from '../src/pack.mjs'

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const SKILL_PATH = join(PLUGIN_DIR, '..', 'skills', 'repo-pack', 'SKILL.md')
const PROVIDER = 'dsh-repomix'
export const name = 'repomix'
export const inject = ['tools', 'skills']

function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return text
  const end = text.indexOf('\n---\n', 4)
  return end === -1 ? text : text.slice(end + 5)
}
const summary = {
  name: 'repo-pack',
  description: 'Pack a repository into a bounded XML/Markdown context file for handoff. Read-only; excludes binaries, VCS, dependencies, and common secret files.',
  whenToUse: 'A task needs a portable, inspectable repository snapshot or a context handoff with an explicit size/token estimate.',
  invocation: { modelInvocable: true, userInvocable: true },
  source: 'bundled', provider: PROVIDER,
  resourceBase: { kind: 'directory', path: join(PLUGIN_DIR, '..', 'skills', 'repo-pack') },
  rank: 600, locator: 'repo-pack', metadata: { domain: 'context', version: '0.1.0' },
}

export function apply(ctx) {
  ctx.tools.register({
    name: 'repo_pack',
    description: 'Pack a local repository into one bounded XML or Markdown document for context handoff. Read-only; skips .git, dependencies, binaries, lockfiles, and common secret files. Always reports truncation and a rough token estimate.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'Repository directory.' },
        format: { type: 'string', enum: ['xml', 'markdown'], description: 'Output format. Default xml.' },
        maxFileBytes: { type: 'integer', minimum: 1024, description: 'Per-file cap. Default 204800.' },
        maxTotalBytes: { type: 'integer', minimum: 1024, description: 'Total cap. Default 1048576.' },
      },
      required: ['path'],
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: { content: { type: 'string' }, files: { type: 'integer' }, bytes: { type: 'integer' }, tokens: { type: 'integer' }, truncated: { type: 'boolean' } },
        required: ['content', 'files', 'bytes', 'tokens', 'truncated'],
      },
      render: (_args, value) => [{ type: 'text', text: value.content }],
    },
    timeoutMs: 60_000,
    async execute(args = {}) {
      const report = await packRepo(args.path, {
        format: args.format || 'xml',
        maxFileBytes: Number.isInteger(args.maxFileBytes) ? args.maxFileBytes : undefined,
        maxTotalBytes: Number.isInteger(args.maxTotalBytes) ? args.maxTotalBytes : undefined,
      })
      return report
    },
  })
  ctx.skills.registerProvider(() => ({
    name: PROVIDER,
    async list() { return [summary] },
    async get(candidate) {
      if (candidate?.name !== 'repo-pack') return undefined
      return { ...summary, content: stripFrontmatter(await readFile(SKILL_PATH, 'utf8')) }
    },
  }))
}

import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, extname, join, relative, resolve, sep } from 'node:path'

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache', '.ssh', '.aws', '.gnupg'])
const SKIP_FILES = new Set(['.DS_Store', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', '.npmrc', '.env'])
const SECRET_FILE = /(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.netrc|id_rsa|id_ed25519|credentials)$/i
const BINARY = /\.(?:png|jpe?g|webp|gif|ico|pdf|zip|gz|tgz|tar|woff2?|ttf|otf|mp4|webm|mp3|wav|wasm|node|so|dll|dylib|exe|bin)$/i
const LANGUAGE = { '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'jsx', '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java', '.md': 'markdown', '.json': 'json', '.yml': 'yaml', '.yaml': 'yaml', '.sh': 'bash', '.css': 'css', '.html': 'html' }

function shouldSkipDir(name) { return SKIP_DIRS.has(name) }
function isText(name) { return !BINARY.test(name) }

async function walk(root, current, output) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name)
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) await walk(root, path, output)
    } else if (!SKIP_FILES.has(entry.name) && !SECRET_FILE.test(entry.name) && isText(entry.name)) {
      output.push(path)
    }
  }
}

function xmlEscape(value) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') }

export async function packRepo(input, { format = 'xml', maxFileBytes = 200 * 1024, maxTotalBytes = 1024 * 1024 } = {}) {
  const root = await resolve(input)
  const info = await stat(root).catch(() => null)
  if (!info?.isDirectory()) throw new Error(`not a directory: ${input}`)
  const paths = []
  await walk(root, root, paths)
  paths.sort((a, b) => a.localeCompare(b))
  const files = []
  let total = 0
  let truncated = false
  for (const path of paths) {
    const size = (await stat(path)).size
    if (size > maxFileBytes) { truncated = true; continue }
    if (total + size > maxTotalBytes) { truncated = true; break }
    const content = await readFile(path, 'utf8').catch(() => '')
    if (content.includes('\u0000')) { truncated = true; continue }
    const rel = relative(root, path).split(sep).join('/')
    files.push({ path: rel, content, bytes: Buffer.byteLength(content), language: LANGUAGE[extname(path).toLowerCase()] || '' })
    total += Buffer.byteLength(content)
  }
  if (format !== 'xml' && format !== 'markdown') throw new Error('format must be xml or markdown')
  const body = format === 'markdown' ? renderMarkdown(root, files) : renderXml(root, files)
  return { root, format, files: files.length, bytes: Buffer.byteLength(body), tokens: Math.ceil(body.length / 4), truncated, content: body }
}

export function renderXml(root, files) {
  const lines = [`<repository root="${xmlEscape(basename(root))}">`]
  for (const file of files) {
    lines.push(`<file path="${xmlEscape(file.path)}" bytes="${file.bytes}">`)
    lines.push('<![CDATA[' + file.content.replaceAll(']]>', ']]]]><![CDATA[>') + ']]>')
    lines.push('</file>')
  }
  lines.push('</repository>')
  return lines.join('\n')
}

export function renderMarkdown(root, files) {
  const lines = [`# Repository: ${basename(root)}`, '']
  for (const file of files) {
    lines.push(`## File: \`${file.path}\``, '', '```' + file.language, file.content.replaceAll('```', '``\\`'), '```', '')
  }
  return lines.join('\n')
}

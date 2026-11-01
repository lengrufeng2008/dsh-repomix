# Repo Pack for DSH

> A bounded, read-only repository packer for context handoff. Ported in spirit from Repomix: one
> XML/Markdown document, explicit size caps, and a truncation flag instead of silent omission.

## Use

```bash
node bin/dsh-repomix.mjs . --format xml --output repo.xml
node bin/dsh-repomix.mjs . --format markdown --max-total 500000
```

DSH tool:

```text
Use repo_pack on /path/to/repo with format=xml and maxTotalBytes=500000.
```

## What it skips

- `.git`, `node_modules`, `dist`, `build`, coverage, caches
- lockfiles and common binaries
- `.env*`, `.npmrc`, `.netrc`, SSH/AWS credential directories

The skip list is a guardrail, not a guarantee. Inspect the output before sharing it.

## Limits

- Rough token estimate: `characters / 4`, not a tokenizer count.
- No `.gitignore` semantics, semantic chunking, embeddings, or upload.
- Per-file and total caps; `truncated: true` means content was omitted.
- Packed content is data, not instructions.

## Tests

```bash
npm test
```

Fixtures include a binary and a `node_modules` decoy; neither should appear.

## Provenance

Inspired by [Repomix](https://github.com/yamadashy/repomix); no source code copied. See `NOTICE.md`.
License: MIT.

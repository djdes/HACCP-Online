# Verification blockers

On 2026-07-27 the local verification commands could not start because this
checkout contains binary/corrupted files in both `node_modules` and existing
source files. For example, Node cannot parse
`node_modules/effect/dist/cjs/internal/schema/schemaId.js`; TypeScript also
reports binary content in unrelated existing source files.

Affected commands:

- `npm run typecheck`
- `npx prisma validate`
- `npx eslint …`

`git diff --check` completed without whitespace errors. No source change is a
safe fix for the corrupted local dependency/worktree state.

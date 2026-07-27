# Evidence

- `git diff --check`: PASS (no whitespace errors).
- `npm run typecheck`: BLOCKED before project checking by binary/corrupted
  third-party declaration files and unrelated existing source files.
- `npx prisma validate`: BLOCKED before schema validation by a binary/corrupted
  local `effect` dependency.
- `npx eslint` on changed files: BLOCKED before linting by a binary/corrupted
  local ESLint dependency.

The implementation was manually inspected against AC1–AC5. Runtime evidence
cannot be produced until the local checkout/dependencies are repaired.

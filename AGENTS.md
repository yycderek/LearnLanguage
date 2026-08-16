# Repository workflow guidance

- After every push, inspect the GitHub Actions `CI` workflow and wait for a terminal result.
- A change is not complete while CI is pending or failing. Read the failing job logs and report the cause before moving on.
- Before a public Sites deployment, require the corresponding GitHub commit to have green CI unless the user explicitly overrides that gate.
- Install dependencies from the repository root with `pnpm install --frozen-lockfile`; this monorepo uses only the root `pnpm-lock.yaml`.
- Before pushing, run `pnpm check`, `pnpm --dir apps/web test`, and `pnpm --dir apps/web lint` when Web files or dependency configuration changed.

# Formula Foundry development guidelines

- **Architecture.** Formula Foundry is a static HTML, CSS, and JavaScript application with no production build or backend. Node.js and Vitest are development and test tooling.
- **Repository guidance.** Consult [calculator architecture](docs/calculator-architecture.md), [calculator development](docs/calculator-development-guide.md), and [testing](docs/testing.md) as relevant. For trivial changes, read only the files needed for the task.
- **Engineering correctness.** Preserve dimensional consistency, unit conversions, sign conventions, engineering assumptions, numerical precision, and input validation. Use independently derived known-answer tests for changes to engineering mathematics.
- **Shared systems.** Reuse the existing unit and material libraries, calculator registry, DOM-free calculation engines, Design Study adapters, diagram infrastructure, and reporting systems where applicable.
- **Documentation accuracy.** When documentation and code disagree, follow implemented behavior and flag the discrepancy.
- **Scope.** Make the smallest change that meets the requirements. Avoid unrelated refactors, dependency upgrades, unnecessary abstractions, and wholesale rewrites.
- **Testing.** Run relevant targeted tests during development and run `npm test` before preparing a PR. Report failures accurately. Never weaken existing engineering test tolerances merely to make tests pass.
- **Git workflow.** Work on dedicated branches and keep PRs focused and reviewable. Never push directly to `main`. Merge or deploy only with explicit authorization.
- **AI-assisted features.** Require an approved architecture and explicit requirements before introducing an LLM provider, API credentials, backend infrastructure, or automated engineering decision-making.
- **Final report.** Summarize files changed, test results, engineering assumptions, and unresolved risks. Include the PR link.

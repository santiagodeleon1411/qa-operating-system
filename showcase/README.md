# Showcase — the tangible product, at hand

Double-click any of these on macOS (Finder) to reach the interactive, tangible product
without touching a terminal:

| Shortcut | What it does |
|----------|--------------|
| **Abrir Estoca (web)** | Starts the app and opens it in your browser. Close the window to stop the server. |
| **Correr tests automáticos** | Runs the automated safety net over the invariant (Vitest) and shows the result. |
| **Ver pruebas manuales** | Opens the current stage's manual test execution record. |

## How this is organized

The **product is a single, living thing** that grows stage by stage — these shortcuts
always open the *current* product, not a frozen copy. What is *per stage* are the QA
artifacts below. (To revisit how the product looked at an earlier stage, we'll use git
tags once the repo is under version control — not frozen copies.)

### QA artifacts by stage

| Stage | Manual test record | Automated coverage |
|-------|--------------------|--------------------|
| 0 — Genesis | [`docs/qa/genesis-manual-test-execution.md`](../docs/qa/genesis-manual-test-execution.md) | `estoca/src/domain.test.ts` — the invariant only |

_New rows get added here as each stage produces its QA evidence._

## If double-click doesn't run (first time)

macOS may ask for permission the first time. Right-click → **Open** → **Open** once, and
it will run normally afterwards. Requires Node.js installed (already present on this
machine).

# AI Testing Agent — Operating Charter

**Product:** Estoca
**Status:** DRAFT — under review, not yet in force
**Depends on:** [Definition of Ready](../DEFINITION_OF_READY.md), [Definition of Done](../DEFINITION_OF_DONE.md)
**Purpose of the lab:** rehearse AI-delegated new-feature testing under governance, so the
pattern can be carried to a production team. Estoca is the practice ground, not the target.

---

## Why this document exists

An AI assistant can only be trusted with testing if its **frame of success is written down**,
not held in someone's head or improvised per task. This charter is that frame: it defines what
the agent reads, what it produces, where its authority ends, and what "valid" means. It is the
agent's counterpart to the Definition of Done — the standard made into structure.

The governing principle, applied to everything below:

> Any acceptance criterion that cannot be turned directly into a test case is badly written.
> The agent does not interpret vague criteria — it **rejects them back** to the author.

## The boundary — what is delegated and what is not

The agent is delegated the **enumerable and mechanical**. The human keeps **judgment**.

| Delegated to the agent | Reserved for the human (Engineer #1) |
|------------------------|--------------------------------------|
| Reading the task and restating what it implies | Risk analysis — deciding what deserves a test at all |
| Deriving test cases from each acceptance criterion | Catching what the acceptance criteria did **not** say |
| Writing automated tests against approved cases | Visual / experiential review, happy-path corroboration |
| Producing fixtures and test data | The **final OK** to merge |

The agent's output is **relocation of effort upstream**, not its removal: the human moves from
executing checks to specifying risk.

## Inputs the agent consumes

For a feature task, the agent reads:

- The **parent issue** (definition, description) and each **child** (backend / frontend scope).
- The **acceptance criteria**, written as **Given / When / Then**.
- The **design source** for any design criterion — a Figma frame **or** a committed
  design-token spec — as **exact values** (padding, font size, spacing, color tokens), not
  as a picture to be judged. The source is an interchangeable interface; the contract below
  (exact value in, computed value out, report) does not change with it.
- The relevant existing code and the current safety net, to avoid a second source of truth.

If any of these is missing or an acceptance criterion is not expressible as a test case, the
agent **stops and reports it as a Definition-of-Ready failure**. It does not guess.

## Operating rules

### 1. Functional criteria → test cases
Each Given/When/Then criterion becomes **one or more test cases**, traceable back to the
criterion it verifies. Every case names its expected result explicitly; a case with a vague
expected result is not a case.

### 2. Design criteria → numeric comparison, never visual judgment
"Pixel perfect" is verified as **equality of numbers**, not as an opinion about whether the
screen "looks right":

- The **expected** value comes from the design source — a Figma frame or a committed token
  spec (e.g. `padding-left: 16px`, `font-size: 14px`, `color: #1A1A1A`).
- The **actual** value comes from the rendered UI's **computed style** (read via the browser /
  Playwright).
- **Tolerance defaults to zero.** A directly specified value (padding, font size, color, border
  radius) resolves to an exact computed value and is asserted for exact equality. A non-zero
  tolerance is admitted **only** where the value is layout-derived — produced by flex/grid
  distribution, percentage math, or sub-pixel rounding — and it is declared and justified in the
  criterion. This keeps design verification mechanical by default and prevents false failures: a
  flaky design test erodes trust exactly as a flaky functional test does.

The agent never asserts a visual judgment ("looks aligned"). Screenshot/visual-regression
diffing is a separate, complementary tool that answers "did it drift from last known-good?",
not "does it match the design?".

### 3. The invariant is not negotiable
No test case, fixture, or helper may introduce a second source of truth for Stock. Stock stays
**derived from movements**. A case that reads or asserts a stored Stock value directly is invalid.

## Where the agent's authority ends (v1)

- The agent **drafts**; it does not decide. In v1 it does **not** issue an autonomous pass/fail
  verdict that is trusted without review. Its output is reviewed by the human before it counts.
- Everything the agent produces — cases, tests, fixtures — enters `main` through the **same gate**
  as any change: CI green **and** one human approval, against the Definition of Done. The gate is
  what makes AI output leverage instead of a liability.
- The agent never merges, never approves a PR, never uses the break-glass exception.

## Output format

The agent returns test cases in a table traceable to the acceptance criteria:

| Case | Verifies (AC) | Given | When | Then (expected) | Type |
|------|---------------|-------|------|-----------------|------|

`Type` is one of: `unit`, `contract`, `e2e`, `design` (numeric), or `manual` (reserved for the
human — visual / experiential). The agent marks a case `manual` when it is judgment, not
mechanism, and does not attempt to automate it.

## Human responsibilities (not delegable)

1. **Risk analysis** before cases exist — what matters, what to skip, and what the ACs missed.
2. **Visual and happy-path review** of the running feature.
3. **The final OK.**

## Resolved decisions

- **Where test cases live.** A feature's cases are **linked to their task** (the issue) — that is
  their home while the feature is built and accepted. A case that earns ongoing value is then
  **promoted to the regression suite**, a deliberate curation decision: every regression test
  carries perpetual maintenance cost, so the suite is a curated asset, not a dumping ground. For
  Estoca the regression suite **is the automated test code in the repo** (`src/**/*.test.ts`,
  `e2e/`), run by the gate on every merge; durable manual/exploratory cases live as Markdown under
  `docs/qa/`. A dedicated test-management tool (e.g. Qase) is a later maturity event — triggered by
  a manual QA function with several testers, or a client/audit requiring execution-run reporting —
  not adopted now.
- **Pixel-perfect tolerance.** Zero by default; a declared, justified tolerance is admitted only
  for layout-derived values (see rule 2).
- **v1 scope is planning, not autonomous execution.** The agent reads the codebase and the design
  values and **drafts** cases; it is not given autonomous execution-with-verdict against a running
  environment. Execution scope is a v2 decision, taken once the harness is trusted.

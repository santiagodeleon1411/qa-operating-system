# Estoca — Genesis slice

The first runnable slice of Estoca: real-time Stock control for a single-branch retail
SMB. This exists to make the QA work of Stage 0 (Genesis) tangible — something a reader
can open, click, and verify — not to be a finished product.

## The one thing this slice proves

**The Stock never lies.** Stock is never stored as a number you can edit. It is always
*derived* from an append-only ledger of **Stock movements** (entries and exits). There
is deliberately **no "set Stock to X" control** — the only way to change Stock is to
record a movement. A number that does not exist cannot drift.

## Run it

```bash
cd estoca
npm install
npm run dev      # open the printed localhost URL, click around
```

## Check it

```bash
npm test         # the automated safety net over the invariant (Vitest)
```

Per [ADR-0003](../docs/adr/0003-genesis-quality-posture.md), automation at Genesis is
scoped to **one thing only**: the pure `movement → Stock` logic in `src/domain.ts`. It
is cheap and stable (the arithmetic does not churn like the UI does). Everything else —
end-to-end UI tests, CI gates, a QA hire — is deliberately deferred. The UI flow is
covered by a **manual** smoke test, recorded in
[`docs/qa/genesis-manual-test-execution.md`](../docs/qa/genesis-manual-test-execution.md).

### The red → green story

The tempting first implementation is a mutable Stock counter you increment and
decrement. It drifts the instant an update is missed or double-applied — that is exactly
"the Stock lies". The regression guard `never drifts from the sum of its ledger` in
`src/domain.test.ts` is what a counter implementation would fail. We chose the derived
model so the catastrophic failure is impossible *by construction*, not merely tested for.

## Layout

```
estoca/
  src/
    domain.ts        # pure invariant logic — Stock derived from movements
    domain.test.ts   # the small automated safety net (the invariant only)
    persistence.ts   # thin localStorage layer + seed catalogue (no backend yet)
    main.ts          # the clickable web wired to the domain
    styles.css
  index.html
```

## Deliberately not here yet

No backend, no database, no persistence beyond the browser, no multi-Merchant, no
offline. Each is a future maturity event that enters when the story justifies its cost.

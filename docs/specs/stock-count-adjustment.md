# Feature spec — Stock adjustment after a physical count

## Status
Ready for development — 2026-07-07. Refined from a raw Product request against the
[Definition of Ready](../DEFINITION_OF_READY.md). Upholds the invariant preserved in
[ADR-0003](../adr/0003-genesis-quality-posture.md) and
[ADR-0006](../adr/0006-backend-and-database-with-the-invariant-in-the-schema.md).

## The problem
Merchants periodically count physical Stock and find it does not match the system — through
breakage, theft, or a data-entry error. They need to reconcile the system to reality.

The request arrived as *"let them set the Stock to the real number they counted."* That is a
proposed solution, and taken literally it requires a writable Stock value — the mutable
counter the invariant forbids. It was reframed to the behaviour below, which gives the
Merchant exactly the outcome they need without ever storing a Stock.

## Behaviour
A Merchant enters the **absolute number they counted**. The system does not store it. It
records the **difference** between the count and the Stock shown when the count began, as a
single adjustment **movement** (an `entry` if the count is higher, an `exit` if lower),
carrying a reason. Stock stays derived from the ledger; the adjustment is auditable like any
other movement, and flows through the same never-negative trigger as a final backstop.

The discrepancy is measured against the Stock captured **when the count began**, not when it
is submitted, so legitimate movements between those two moments remain correct.

## In scope
- Entering a counted number and recording the resulting adjustment movement with a reason.
- Validating the counted number and the reason at the boundary.
- Surfacing a Stock change that happened during the count before anything is recorded.

## Out of scope (deferred)
- **Multi-device optimistic locking.** With one Merchant on one device, capturing the Stock
  at count-open and warning on change is proportionate; contention between two simultaneous
  counts is not a present risk.
- **Per-user attribution ("who adjusted").** There are no user accounts yet; the ledger
  records what and when, not who. Revisit when accounts exist.

---

## Acceptance criteria

```gherkin
Background:
  Given the catalogue includes "Café" with a threshold of 5

Scenario: A count below the system Stock records a downward adjustment
  Given the system shows a Stock of 42 for "Café" when the count begins
  When the Merchant submits a physical count of 39 with a reason
  Then a single exit adjustment of 3 is recorded, carrying that reason
  And the Stock for "Café" derives to 39
  And no Stock value is stored — only the adjustment movement

Scenario: A count above the system Stock records an upward adjustment
  Given the system shows a Stock of 42 for "Café" when the count begins
  When the Merchant submits a physical count of 50 with a reason
  Then a single entry adjustment of 8 is recorded, carrying that reason
  And the Stock for "Café" derives to 50

Scenario: A count that matches the system records nothing
  Given the system shows a Stock of 42 for "Café" when the count begins
  When the Merchant submits a physical count of 42
  Then no movement is recorded
  And the Merchant is told the count already matches — there is nothing to adjust

Scenario: A count of zero is valid
  Given the system shows a Stock of 42 for "Café" when the count begins
  When the Merchant submits a physical count of 0 with a reason
  Then an exit adjustment of 42 is recorded
  And the Stock for "Café" derives to 0

Scenario: A negative count is refused at the boundary
  Given a count is in progress for "Café"
  When the Merchant submits a physical count of -3
  Then the adjustment is refused with a message that a count cannot be negative
  And no movement is recorded

Scenario: A non-whole count is refused at the boundary
  Given a count is in progress for "Café"
  When the Merchant submits a physical count of 3.5
  Then the adjustment is refused with a message that units are counted whole
  And no movement is recorded

Scenario: An adjustment without a reason is refused
  Given the system shows a Stock of 42 for "Café" when the count begins
  When the Merchant submits a physical count of 39 without a reason
  Then the adjustment is refused with a message that a reason is required
  And no movement is recorded

Scenario: The discrepancy is measured from the count, not the submission
  Given the system shows a Stock of 42 for "Café" when the count begins
  And the Merchant counts 39 physical units
  And 1 unit of "Café" is sold before the count is submitted, so the Stock is now 41
  When the Merchant confirms and submits the count of 39
  Then the adjustment recorded is 3 — the discrepancy found at count time, not 2
  And the Stock for "Café" derives to 38, the true amount on the shelf

Scenario: A Stock change during the count is surfaced before recording
  Given the system shows a Stock of 42 for "Café" when the count begins
  And 1 unit of "Café" is sold before the count is submitted
  When the Merchant submits the count
  Then the Merchant is warned that the Stock changed since the count began
  And is asked to reconfirm or recount before any adjustment is recorded
```

## Note on the reason
A reason is required (the schema already refuses an empty one). Because the *why* of a
discrepancy is what the business acts on — shrinkage, breakage, a data-entry error — the
interface offers those as selectable categories with optional detail, so "the reason
explains the discrepancy" is enforced by structure rather than left to free text.

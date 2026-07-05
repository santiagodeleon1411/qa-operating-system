<!--
  This template applies our Definition of Done to every PR, so the three human checks
  are recorded here rather than relied on from memory. See docs/DEFINITION_OF_DONE.md.
-->

## What & why

<!-- What does this change do, and why? Write it so the reviewer can restate it in their
     own words. If it cannot be stated clearly, the change is not done yet. -->



## Reviewer checklist (the human half of "done")

- [ ] **Invariant by design** — Stock is still *derived* from movements. No new counter,
      no second parallel calculation, no new source of truth. (A new path can pass the
      existing tests simply by not exercising them.)
- [ ] **New behavior is tested** — anything new here is covered by a test; the safety net
      was extended with the change.
- [ ] **I understand it** — I can restate what this change does and why in my own words.
      If not, it is clarified or simplified before merge.

<!-- The automated half — CI green (safety net + build) — is verified by the machine and
     is not re-checked by hand. -->

## Break-glass (delete this section unless it applies)

<!-- Merge without the required approval only when BOTH conditions hold:
     (1) waiting causes real, present harm, AND (2) the reviewer is genuinely unavailable.
     If the exception was used, record the reasons below. -->

- **Why waiting caused real harm:**
- **Why the reviewer was unavailable:**
- **Retroactive review owed to:** <!-- @who, to review once available -->

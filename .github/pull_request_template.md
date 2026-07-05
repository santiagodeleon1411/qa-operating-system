<!--
  This template makes our Definition of Done easy to satisfy — so the three human
  checks live in the PR, not in anyone's memory. See docs/DEFINITION_OF_DONE.md.
-->

## What & why

<!-- What does this change do, and why? Write it so the reviewer can explain it back
     in their own words. If you can't write this clearly, the change isn't done yet. -->



## Reviewer checklist (the human half of "done")

- [ ] **Invariant by design** — Stock is still *derived* from movements. No new counter,
      no second parallel calculation, no new source of truth. (A new path can pass the old
      tests just by not touching them.)
- [ ] **New behavior is tested** — anything new here is covered by a test; the safety net
      grew with the change.
- [ ] **I understand it** — I can explain what this change does and why in my own words.
      If not, it gets clarified or simplified before merge.

<!-- The mechanical half — CI green (safety net + build) — is checked by the machine.
     Don't re-verify it by hand. -->

## Break-glass (delete this section unless you are using it)

<!-- Only merge without the required approval when BOTH hold:
     (1) waiting causes real, present harm, AND (2) the reviewer is genuinely unavailable.
     If you broke the glass, say so here — the mark must be legible. -->

- **Why waiting caused real harm:**
- **Why the reviewer was unavailable:**
- **Retroactive review owed to:** <!-- @who, to look the moment they're back -->

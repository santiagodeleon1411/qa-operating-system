// Estoca — authorization: which role may perform which write. See
// docs/specs/authorization-role-model.md and docs/adr/0008.
//
// Pure policy, in the spirit of domain.ts: no I/O, no session, no transport. Given a role and an
// action it answers allow or deny, and nothing else. Two things worth stating up front:
//
//  - The unit of authorization for an adjustment is its REASON, not the bare action. An employee
//    may record a shortfall, but only the owner may classify one as theft ("Theft or loss") —
//    segregation of duties, so whoever moves the merchandise is not the one who writes off its
//    disappearance.
//  - This module is the policy; enforcement lives at the write edge (server/handlers.ts), and the
//    UI merely reflects it. A hidden button is a courtesy; the handler is the guarantee.

export const ROLES = ['owner', 'employee', 'runner'] as const;
export type Role = (typeof ROLES)[number];

/**
 * The closed set of reasons a physical-count adjustment may carry. Closed, not free text,
 * precisely because the reason is what authorization turns on: the vocabulary is owned by the
 * server, so "Theft or loss" is one exact, guardable value — not a string a caller can spell
 * their way around. "Unclassified shortfall" is the neutral reason that lets an employee record
 * a shortfall without asserting a cause (the maker-checker split from the spec).
 */
export const ADJUSTMENT_REASONS = [
  'Breakage',
  'Data entry error',
  'Unclassified shortfall',
  'Theft or loss',
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** The owner-only classification: writing a shortfall off as an accounted-for loss. */
export const OWNER_ONLY_ADJUSTMENT_REASON: AdjustmentReason = 'Theft or loss';

/**
 * May this role record a movement of this kind? Owner and employee record both directions; the
 * runner is a delivery role — exits (deliveries out) yes, entries (restocking) no.
 */
export function canRecordMovement(role: Role, kind: 'entry' | 'exit'): boolean {
  if (role === 'owner' || role === 'employee') return true;
  return kind === 'exit';
}

/**
 * May this role record an adjustment carrying this reason? The runner records no adjustments at
 * all. The theft-or-loss classification is the owner's alone. Every other reason is open to the
 * owner and the employee.
 */
export function canRecordAdjustment(role: Role, reason: AdjustmentReason): boolean {
  if (role === 'runner') return false;
  if (reason === OWNER_ONLY_ADJUSTMENT_REASON) return role === 'owner';
  return true;
}

/**
 * May this role set a Product's low-stock threshold? The threshold is a shop-wide policy
 * setting — what counts as "low" for each Product — so it belongs to the owner alone. An
 * employee or runner recording Stock does not get to redraw the line that decides when the
 * shop is warned. Unlike movement/adjustment authorization, this turns only on the role: there
 * is no per-value carve-out, so the guard can run before the request body is even parsed.
 */
export function canSetThreshold(role: Role): boolean {
  return role === 'owner';
}

// Estoca — authorization: which role may perform which write. See
// docs/specs/authorization-role-model.md and docs/adr/0008.
//
// Pure policy, in the spirit of domain.ts: no I/O, no session, no transport. Given a role and an
// action it answers allow or deny, and nothing else. Two things worth stating up front:
//
//  - The unit of authorization for an adjustment is its REASON, not the bare action. An employee
//    may record a shortfall, but only the owner may classify one as theft ("Robo o pérdida") —
//    segregation of duties, so whoever moves the merchandise is not the one who writes off its
//    disappearance.
//  - This module is the policy; enforcement lives at the write edge (server/handlers.ts), and the
//    UI merely reflects it. A hidden button is a courtesy; the handler is the guarantee.

export const ROLES = ['owner', 'employee', 'runner'] as const;
export type Role = (typeof ROLES)[number];

/**
 * The closed set of reasons a physical-count adjustment may carry. Closed, not free text,
 * precisely because the reason is what authorization turns on: the vocabulary is owned by the
 * server, so "Robo o pérdida" is one exact, guardable value — not a string a caller can spell
 * their way around. "Faltante sin clasificar" is the neutral reason that lets an employee record
 * a shortfall without asserting a cause (the maker-checker split from the spec).
 */
export const ADJUSTMENT_REASONS = [
  'Rotura',
  'Error de carga',
  'Faltante sin clasificar',
  'Robo o pérdida',
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** The owner-only classification: writing a shortfall off as an accounted-for loss. */
export const OWNER_ONLY_ADJUSTMENT_REASON: AdjustmentReason = 'Robo o pérdida';

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

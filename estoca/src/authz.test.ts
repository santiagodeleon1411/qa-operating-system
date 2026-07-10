import { describe, it, expect } from 'vitest';
import {
  ROLES,
  ADJUSTMENT_REASONS,
  canRecordMovement,
  canRecordAdjustment,
  type Role,
  type AdjustmentReason,
} from './authz';

// The permission matrix from docs/specs/authorization-role-model.md, asserted cell by cell.
// The DENIALS are the point: they are the tests that prove the policy has teeth, the same way
// the XSS regression proved its fix did. Every role is covered against every action and reason,
// so a change to the policy this table does not expect fails loudly.

describe('movement permissions (kind × role)', () => {
  const expected: Record<Role, { entry: boolean; exit: boolean }> = {
    owner: { entry: true, exit: true },
    employee: { entry: true, exit: true },
    runner: { entry: false, exit: true }, // a delivery role: deliveries out, but no restocking
  };
  for (const role of ROLES) {
    it(`${role}: entry=${expected[role].entry}, exit=${expected[role].exit}`, () => {
      expect(canRecordMovement(role, 'entry')).toBe(expected[role].entry);
      expect(canRecordMovement(role, 'exit')).toBe(expected[role].exit);
    });
  }
});

describe('adjustment permissions (reason × role)', () => {
  // The runner records no adjustments; theft-or-loss is the owner's alone; everything else is
  // open to owner and employee.
  const allows: Record<Role, (reason: AdjustmentReason) => boolean> = {
    owner: () => true,
    employee: (r) => r !== 'Robo o pérdida',
    runner: () => false,
  };
  for (const role of ROLES) {
    for (const reason of ADJUSTMENT_REASONS) {
      const allowed = allows[role](reason);
      it(`${role} ${allowed ? 'may' : 'may not'} record "${reason}"`, () => {
        expect(canRecordAdjustment(role, reason)).toBe(allowed);
      });
    }
  }
});

describe('the load-bearing control: segregation of duties on theft', () => {
  it('only the owner may classify a shortfall as theft or loss', () => {
    expect(canRecordAdjustment('owner', 'Robo o pérdida')).toBe(true);
    expect(canRecordAdjustment('employee', 'Robo o pérdida')).toBe(false);
    expect(canRecordAdjustment('runner', 'Robo o pérdida')).toBe(false);
  });

  it('the employee can still record the shortfall, just not classify it as theft', () => {
    expect(canRecordAdjustment('employee', 'Faltante sin clasificar')).toBe(true);
  });
});

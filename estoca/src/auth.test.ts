import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, newSessionToken } from './auth';

describe('password hashing', () => {
  it('verifies the correct password against its stored hash', () => {
    const stored = hashPassword('secret-password');
    expect(verifyPassword('secret-password', stored)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const stored = hashPassword('secret-password');
    expect(verifyPassword('wrong-password', stored)).toBe(false);
  });

  it('never stores the plaintext', () => {
    const stored = hashPassword('secret-password');
    expect(stored).not.toContain('secret-password');
  });

  it('salts: the same password hashes differently every time', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('rejects a malformed stored value instead of throwing', () => {
    expect(verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
  });
});

describe('session tokens', () => {
  it('are unguessable and unique per call', () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // 32 random bytes, hex
  });
});

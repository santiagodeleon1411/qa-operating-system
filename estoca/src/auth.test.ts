import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, newSessionToken } from './auth';

describe('password hashing', () => {
  it('verifies the correct password against its stored hash', () => {
    const stored = hashPassword('contraseña-secreta');
    expect(verifyPassword('contraseña-secreta', stored)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const stored = hashPassword('contraseña-secreta');
    expect(verifyPassword('contraseña-equivocada', stored)).toBe(false);
  });

  it('never stores the plaintext', () => {
    const stored = hashPassword('contraseña-secreta');
    expect(stored).not.toContain('contraseña-secreta');
  });

  it('salts: the same password hashes differently every time', () => {
    expect(hashPassword('misma')).not.toBe(hashPassword('misma'));
  });

  it('rejects a malformed stored value instead of throwing', () => {
    expect(verifyPassword('cualquiera', 'no-es-un-hash-valido')).toBe(false);
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

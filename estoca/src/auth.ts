// Estoca — authentication primitives. See docs/adr/0008.
//
// Backend-only: this module uses node:crypto and must never enter the frontend's import
// graph. It holds the two security-sensitive operations identity depends on — hashing a
// password for storage, and minting a session token — built on the platform's crypto so no
// new dependency joins the bundle for something Node already does well.

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// scrypt is a deliberately slow, memory-hard key-derivation function: the cost of hashing one
// password is trivial, the cost of brute-forcing millions is not. 64-byte derived key.
const KEY_LENGTH = 64;

/**
 * Hash a password for storage as "salt:hash" (both hex). A fresh random salt per password
 * means two identical passwords never share a hash, so a stolen table cannot be attacked
 * with one precomputed dictionary. The plaintext is never stored and cannot be recovered.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * Verify a password against a stored "salt:hash". The comparison is constant-time
 * (`timingSafeEqual`): it takes the same time whether the first byte is wrong or the last,
 * so an attacker cannot learn the hash byte by byte from response timing.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** A new opaque session token: 32 random bytes, unguessable, with no meaning to decode. */
export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}

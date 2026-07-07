import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from './schema';
import { AuthRepo } from './auth-repo';

// Ana is a seeded user (src/users.ts) with the dev password 'estoca-ana'.
const now = '2026-07-06T00:00:00.000Z';
const later = '2026-07-06T09:00:00.000Z'; // past an 8h session
const soon = '2026-07-06T01:00:00.000Z'; // within an 8h session

describe('authentication', () => {
  let auth: AuthRepo;
  beforeEach(() => {
    auth = new AuthRepo(createDb());
  });

  it('accepts the right credentials and returns the user without the hash', () => {
    const user = auth.authenticate('ana', 'estoca-ana');
    expect(user).toMatchObject({ id: 'u-ana', username: 'ana', name: 'Ana' });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects a wrong password', () => {
    expect(auth.authenticate('ana', 'incorrecta')).toBeNull();
  });

  it('rejects an unknown user the same way as a wrong password (no user enumeration)', () => {
    expect(auth.authenticate('fantasma', 'lo-que-sea')).toBeNull();
  });
});

describe('sessions', () => {
  let auth: AuthRepo;
  beforeEach(() => {
    auth = new AuthRepo(createDb());
  });

  it('resolves the acting user from a live token', () => {
    const token = auth.createSession('u-ana', later);
    expect(auth.userForToken(token, soon)).toMatchObject({ id: 'u-ana', name: 'Ana' });
  });

  it('treats an expired session as no session', () => {
    const token = auth.createSession('u-ana', now); // expires at `now`
    expect(auth.userForToken(token, later)).toBeNull();
  });

  it('resolves an unknown token to null', () => {
    expect(auth.userForToken('no-existe', soon)).toBeNull();
  });

  it('deletes a session on logout, so its token no longer resolves', () => {
    const token = auth.createSession('u-ana', later);
    auth.deleteSession(token);
    expect(auth.userForToken(token, soon)).toBeNull();
  });
});

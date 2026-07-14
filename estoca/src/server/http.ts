// Estoca — the backend process. See docs/adr/0007 and docs/adr/0008.
//
// This is the thin transport glue the pure handlers were designed to be independent of: it
// reads the HTTP request, resolves the session cookie to an acting user, routes to a handler,
// and writes the handler's { status, body } back as JSON — setting or clearing the session
// cookie when the handler asks. All the contract and authentication logic lives in
// handlers.ts; the only security-relevant thing here is that the session cookie is httpOnly
// (unreadable by browser JavaScript) so an XSS cannot steal it.
//
// Run it with `npm run dev:api` (tsx). The database is in-memory, so Stock, users, and
// sessions reset when the process restarts — acceptable for a dev backend.

import http from 'node:http';
import { createDb } from '../db/schema';
import { MovementsRepo } from '../db/movements-repo';
import { ProductsRepo } from '../db/products-repo';
import { AuthRepo } from '../db/auth-repo';
import {
  login,
  logout,
  me,
  getProducts,
  setThreshold,
  getMovements,
  postMovement,
  postAdjustment,
  SESSION_TTL_MS,
  type HandlerResult,
} from './handlers';

const db = createDb();
const repo = new MovementsRepo(db);
const products = new ProductsRepo(db);
const auth = new AuthRepo(db);

const COOKIE = 'session';

/** Read the session token from the request's Cookie header, or null if absent. */
function sessionToken(req: http.IncomingMessage): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=') || null;
  }
  return null;
}

// SameSite=Strict + HttpOnly: the cookie is never sent cross-site and never readable by JS.
// In production over HTTPS this must also carry `Secure`; omitted here only because dev is http.
function setCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}
function clearCookie(): string {
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

function respond(res: http.ServerResponse, result: HandlerResult<unknown>): void {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
  if (result.setSession === null) headers['Set-Cookie'] = clearCookie();
  else if (typeof result.setSession === 'string') headers['Set-Cookie'] = setCookie(result.setSession);
  res.writeHead(result.status, headers);
  res.end(JSON.stringify(result.body));
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch {
        reject(new Error('The request body is not valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const now = new Date().toISOString();
    const token = sessionToken(req);
    const actor = token ? auth.userForToken(token, now) : null;

    if (req.method === 'POST' && req.url === '/login') {
      return respond(res, login(auth, await readBody(req), now));
    }
    if (req.method === 'POST' && req.url === '/logout') {
      return respond(res, logout(auth, token));
    }
    if (req.method === 'GET' && req.url === '/me') {
      return respond(res, me(actor));
    }
    if (req.method === 'GET' && req.url === '/products') {
      return respond(res, getProducts(products, actor));
    }
    if (req.method === 'PATCH' && req.url === '/products') {
      return respond(res, setThreshold(products, actor, await readBody(req), now));
    }
    if (req.method === 'GET' && req.url === '/movements') {
      return respond(res, getMovements(repo, actor));
    }
    if (req.method === 'POST' && req.url === '/movements') {
      return respond(res, postMovement(repo, actor, await readBody(req), now));
    }
    if (req.method === 'POST' && req.url === '/adjustments') {
      return respond(res, postAdjustment(repo, actor, await readBody(req), now));
    }
    respond(res, { status: 404, body: { error: 'That resource does not exist.' } });
  } catch (e) {
    // A malformed body reaches here; treat it as a rejected request, in contract shape.
    respond(res, { status: 422, body: { error: e instanceof Error ? e.message : 'Invalid request.' } });
  }
});

const port = Number(process.env.PORT ?? 3001);
server.listen(port, () => {
  console.log(`Estoca backend listening on http://localhost:${port}`);
});

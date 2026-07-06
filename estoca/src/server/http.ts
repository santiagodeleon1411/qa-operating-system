// Estoca — the backend process. See docs/adr/0007.
//
// This is the thin transport glue the pure handlers were designed to be independent of: it
// reads the HTTP request, routes it to a handler, and writes the handler's {status, body}
// back as JSON. All the contract logic lives in handlers.ts; nothing here needs testing
// that the handler tests do not already cover.
//
// Run it with `npm run dev:api` (tsx). The database is in-memory, so Stock resets when the
// process restarts — acceptable for a dev backend; durability is a deployment concern, not
// a code one, and is out of scope for this slice.

import http from 'node:http';
import { createDb } from '../db/schema';
import { MovementsRepo } from '../db/movements-repo';
import { getProducts, postMovement, postAdjustment } from './handlers';

const repo = new MovementsRepo(createDb());

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch {
        reject(new Error('El cuerpo de la solicitud no es JSON válido.'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/products') {
      const { status, body } = getProducts(repo);
      return send(res, status, body);
    }
    if (req.method === 'POST' && req.url === '/movements') {
      const { status, body } = postMovement(repo, await readBody(req));
      return send(res, status, body);
    }
    if (req.method === 'POST' && req.url === '/adjustments') {
      const { status, body } = postAdjustment(repo, await readBody(req));
      return send(res, status, body);
    }
    send(res, 404, { error: 'No existe ese recurso.' });
  } catch (e) {
    // A malformed body reaches here; treat it as a rejected request, in contract shape.
    send(res, 422, { error: e instanceof Error ? e.message : 'Solicitud inválida.' });
  }
});

const port = Number(process.env.PORT ?? 3001);
server.listen(port, () => {
  console.log(`Estoca backend escuchando en http://localhost:${port}`);
});

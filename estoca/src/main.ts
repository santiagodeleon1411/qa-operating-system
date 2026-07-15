import './styles.css';
import {
  login,
  logout,
  fetchMe,
  fetchProducts,
  fetchMovements,
  recordMovement,
  recordAdjustment,
  setThreshold,
  MovementRefused,
  NotAuthenticated,
  Forbidden,
  ThresholdRefused,
} from './api/client';
import type { ProductView, Movement, SessionUser } from './contract';
import type { AdjustmentReason } from './authz';

// The whole app sits behind a session (ADR-0008). On load we ask the backend who we are:
// a user renders the shop; no session renders the login; a network failure renders the
// unavailable state. Every write is attributed server-side to this user; the frontend never
// sends "who".

let user: SessionUser | null = null;

// The Stock each Product showed when the screen loaded — the snapshot a physical count is
// measured against (docs/specs/stock-count-adjustment.md).
let current: ProductView[] = [];

// The movements last rendered on screen, kept so a threshold change can re-render the table
// from memory — using the server's returned view — without re-fetching the whole shop (TC-22).
let currentMovements: Movement[] = [];

const app = document.querySelector<HTMLDivElement>('#app')!;

// Every value interpolated into innerHTML below is escaped through this. A movement's `reason`
// is free text the Merchant types; the actor and product names will become editable in later
// slices. Untrusted text rendered as markup is a stored-XSS sink, so it is neutralized here at
// the boundary where it becomes HTML — the one place it can do harm.
function esc(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function header(): string {
  return `
    <header>
      <h1>Estoca</h1>
      <p class="tagline">Real-time stock control — stock never lies.</p>
    </header>`;
}

function renderLoading(): void {
  app.innerHTML = `${header()}<section class="panel"><p class="note">Loading…</p></section>`;
}

function renderUnavailable(): void {
  app.innerHTML = `${header()}
    <section class="panel">
      <p class="error" role="alert">
        We could not load your stock right now. This is usually a temporary connection
        problem — <strong>your data is saved, nothing was lost.</strong>
        Check your internet connection and try again in a few seconds. If the problem
        persists, contact support.
      </p>
      <button id="retry" type="button">Retry</button>
    </section>`;
  document.querySelector<HTMLButtonElement>('#retry')!.addEventListener('click', boot);
}

function renderLogin(message = ''): void {
  app.innerHTML = `${header()}
    <section class="panel">
      <h2>Sign in</h2>
      <form id="login-form">
        <label>Username
          <input name="username" type="text" autocomplete="username" />
        </label>
        <label>Password
          <input name="password" type="password" autocomplete="current-password" />
        </label>
        <button type="submit">Sign in</button>
      </form>
      <p id="login-error" class="error" role="alert">${esc(message)}</p>
    </section>`;
  document.querySelector<HTMLFormElement>('#login-form')!.addEventListener('submit', onLogin);
}

async function onLogin(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  const data = new FormData(e.currentTarget as HTMLFormElement);
  try {
    user = await login({
      username: String(data.get('username') ?? ''),
      password: String(data.get('password') ?? ''),
    });
    await loadApp();
  } catch (err) {
    renderLogin(
      err instanceof NotAuthenticated
        ? 'Incorrect username or password.'
        : 'We could not sign you in. Check your connection and try again.',
    );
  }
}

async function onLogout(): Promise<void> {
  await logout();
  user = null;
  renderLogin();
}

function renderApp(products: ProductView[], movements: Movement[]): void {
  current = products; // the snapshot a physical count will be measured against
  currentMovements = movements; // retained so a threshold save can re-render without a re-fetch

  // The UI reflects the actor's role (docs/specs/authorization-role-model.md). This is a
  // courtesy — hiding a control the role may not use — NOT the guarantee: authorization is
  // enforced server-side at the write edge regardless of what the screen shows.
  const role = user?.role ?? 'employee';
  const canEntry = role === 'owner' || role === 'employee'; // the runner records exits only
  const canAdjust = role === 'owner' || role === 'employee'; // the runner records no adjustments
  const canClassifyTheft = role === 'owner'; // theft-or-loss is the owner's alone
  const isOwner = role === 'owner'; // only the owner may set a Product's low-stock threshold
  const roleLabel = { owner: 'Owner', employee: 'Employee', runner: 'Runner' }[role];

  const productOptions = products
    .map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`)
    .join('');

  // The adjustment panel, shown only to roles that may adjust. The theft-or-loss reason is
  // offered only to the owner; everyone who can adjust gets the neutral "Unclassified shortfall".
  const adjustPanel = canAdjust
    ? `
    <section class="panel">
      <h2>Adjust by physical count</h2>
      <form id="adjust-form">
        <label>Product
          <select name="productId">${productOptions}</select>
        </label>
        <label>You counted
          <input name="counted" type="number" min="0" step="1" value="0" />
        </label>
        <label>Reason for the difference
          <select name="reason">
            <option value="" disabled selected>Choose a reason…</option>
            <option value="Breakage">Breakage</option>
            <option value="Data entry error">Data entry error</option>
            <option value="Unclassified shortfall">Unclassified shortfall</option>
            ${canClassifyTheft ? '<option value="Theft or loss">Theft or loss</option>' : ''}
          </select>
        </label>
        <button type="submit">Record adjustment</button>
      </form>
      <p class="note">
        Enter the actual number you counted. The system records the difference as a
        movement — it never rewrites Stock by hand.
      </p>
      <p id="adjust-msg" class="error" role="status"></p>
    </section>`
    : '';

  app.innerHTML = `${header()}
    <section class="panel topbar">
      <span class="note">Signed in as <strong>${esc(user?.name ?? '')}</strong> · ${esc(roleLabel)}</span>
      <button id="logout" type="button">Sign out</button>
    </section>

    <section class="panel">
      <h2>Current stock</h2>
      <table>
        <thead><tr>
          <th>Product</th>
          <th class="num">Stock</th>
          ${isOwner ? '<th class="num">Threshold</th>' : ''}
          <th>Status</th>
        </tr></thead>
        <tbody>
          ${products
            .map((p) => {
              // The screen reflects the server's low-stock decision as given; it never recomputes
              // it from stock and threshold, so there is one source of that decision (TC-18/19).
              const badge = p.belowThreshold
                ? '<span class="low-stock-badge">Low stock</span>'
                : '<span class="status-ok">In stock</span>';
              // The threshold control belongs to the owner alone (TC-20/21); the column is absent
              // for other roles. An unset threshold shows empty with a placeholder — it resolves
              // to the default server-side, so the field is not pre-filled with a value nobody set.
              const thresholdCell = isOwner
                ? `<td class="num">
                     <input class="thr-input" type="number" min="0" step="1"
                       value="${p.threshold ?? ''}" placeholder="—"
                       data-product="${esc(p.id)}" aria-label="${esc(p.name)} threshold" />
                     <button type="button" class="thr-save" data-product="${esc(p.id)}">Save</button>
                   </td>`
                : '';
              return `<tr>
                <td>${esc(p.name)}</td>
                <td class="stock num">${p.stock}</td>
                ${thresholdCell}
                <td>${badge}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      ${isOwner ? '<p id="threshold-msg" class="error" role="status"></p>' : ''}
      <p class="note">
        There is no way to edit Stock directly. You only record a movement
        — Stock is derived from the sum of movements, in the backend.
      </p>
    </section>

    <section class="panel">
      <h2>Record movement</h2>
      <form id="movement-form">
        <label>Product
          <select name="productId">
            ${products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
          </select>
        </label>
        <label>Type
          <select name="kind">
            ${canEntry ? '<option value="entry">Entry (+)</option>' : ''}
            <option value="exit">Exit (−)</option>
          </select>
        </label>
        <label>Quantity
          <input name="quantity" type="number" min="1" step="1" value="1" />
        </label>
        <label>Reason
          <input name="reason" type="text" placeholder="Sale, purchase, adjustment…" />
        </label>
        <button type="submit">Record</button>
      </form>
      <p id="error" class="error" role="alert"></p>
    </section>

    ${adjustPanel}

    <section class="panel">
      <h2>Movement history</h2>
      <table>
        <thead><tr><th>When</th><th>Product</th><th>Movement</th><th>Reason</th><th>Who</th></tr></thead>
        <tbody id="history">
          ${movements.length === 0 ? '<tr><td colspan="5" class="note">No movements yet.</td></tr>' : ''}
          ${movements
            .map((m) => {
              const name = products.find((p) => p.id === m.productId)?.name ?? m.productId;
              const sign = m.kind === 'entry' ? '+' : '−';
              return `<tr>
                <td>${esc(new Date(m.at).toLocaleString('es-AR'))}</td>
                <td>${esc(name)}</td>
                <td>${sign}${m.quantity}</td>
                <td>${esc(m.reason)}</td>
                <td class="actor">${esc(m.actorName)}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </section>`;

  document.querySelector<HTMLButtonElement>('#logout')!.addEventListener('click', onLogout);
  document.querySelector<HTMLFormElement>('#movement-form')!.addEventListener('submit', onSubmit);
  // The adjust form is absent for roles that may not adjust (the runner); wire it only if shown.
  document.querySelector<HTMLFormElement>('#adjust-form')?.addEventListener('submit', onAdjust);
  // The threshold Save buttons exist only in the owner's render; wire whichever are present.
  document
    .querySelectorAll<HTMLButtonElement>('.thr-save')
    .forEach((btn) => btn.addEventListener('click', onSaveThreshold));
}

async function onSubmit(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const errorEl = document.querySelector<HTMLParagraphElement>('#error')!;
  errorEl.textContent = '';

  try {
    await recordMovement({
      productId: String(data.get('productId')),
      kind: data.get('kind') as 'entry' | 'exit',
      quantity: Number(data.get('quantity')),
      reason: String(data.get('reason') ?? ''),
    });
    await loadApp(); // re-read the truth from the backend
  } catch (err) {
    if (err instanceof NotAuthenticated) return renderLogin('Your session expired. Sign in again.');
    // A refused movement (domain/invariant) or a forbidden one (role) carries the backend's
    // reason; anything else is a transport failure.
    errorEl.textContent =
      err instanceof MovementRefused || err instanceof Forbidden
        ? err.message
        : 'We could not record the movement. Check your connection and try again — nothing was saved, so you can retry without duplicating.';
  }
}

interface CountInput {
  productId: string;
  counted: number;
  reason: AdjustmentReason;
  expectedStock: number;
}

async function onAdjust(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  const data = new FormData(e.currentTarget as HTMLFormElement);
  const productId = String(data.get('productId'));
  await submitAdjustment(
    {
      productId,
      counted: Number(data.get('counted')),
      // The reason comes from a <select> whose options are exactly the authorized reasons; the
      // server re-validates it against the same closed set regardless.
      reason: String(data.get('reason') ?? '') as AdjustmentReason,
      // Measured against the Stock this Product showed when the screen loaded, not now.
      expectedStock: current.find((p) => p.id === productId)?.stock ?? 0,
    },
    false,
  );
}

async function submitAdjustment(input: CountInput, confirmed: boolean): Promise<void> {
  const msg = document.querySelector<HTMLParagraphElement>('#adjust-msg')!;
  msg.textContent = '';
  try {
    const outcome = await recordAdjustment({ ...input, confirmed });
    if (outcome.kind === 'recorded') return void (await loadApp()); // re-read the truth
    if (outcome.kind === 'unchanged') {
      msg.textContent = 'The count matches the system. There is no adjustment to record.';
      return;
    }
    // Stock changed during the count: keep the original count, let the Merchant reconfirm.
    msg.innerHTML =
      `Stock changed since you started the count (there are now ${outcome.currentStock}). ` +
      `If your count is still valid, confirm it. ` +
      `<button id="confirm-count" type="button">Confirm my count</button>`;
    document
      .querySelector<HTMLButtonElement>('#confirm-count')!
      .addEventListener('click', () => void submitAdjustment(input, true));
  } catch (err) {
    if (err instanceof NotAuthenticated) return renderLogin('Your session expired. Sign in again.');
    msg.textContent =
      err instanceof MovementRefused || err instanceof Forbidden
        ? err.message
        : 'We could not record the adjustment. Check your connection and try again.';
  }
}

/**
 * The owner sets a Product's low-stock threshold. The server returns the updated Product view;
 * the row re-renders from that response — no reload, no re-fetch — so the low-stock decision
 * still comes from one place, the server (TC-22). An empty or non-integer value is refused before
 * the request; a value the backend rejects (out of range) carries the backend's own message.
 */
async function onSaveThreshold(e: Event): Promise<void> {
  const productId = (e.currentTarget as HTMLButtonElement).dataset.product!;
  const input = document.querySelector<HTMLInputElement>(
    `.thr-input[data-product="${CSS.escape(productId)}"]`,
  )!;
  const msg = document.querySelector<HTMLParagraphElement>('#threshold-msg')!;
  msg.textContent = '';

  const raw = input.value.trim();
  if (raw === '' || !Number.isInteger(Number(raw))) {
    msg.textContent = 'Enter a whole number to set the threshold.';
    return;
  }

  try {
    const updated = await setThreshold({ productId, threshold: Number(raw) });
    // Replace the row from the server's view and re-render from memory — no re-fetch.
    current = current.map((p) => (p.id === updated.id ? updated : p));
    renderApp(current, currentMovements);
  } catch (err) {
    if (err instanceof NotAuthenticated) return renderLogin('Your session expired. Sign in again.');
    msg.textContent =
      err instanceof ThresholdRefused || err instanceof Forbidden
        ? err.message
        : 'We could not save the threshold. Check your connection and try again.';
  }
}

/** Load the shop for the authenticated user. A lost session drops back to the login. */
async function loadApp(): Promise<void> {
  renderLoading();
  try {
    const [products, movements] = await Promise.all([fetchProducts(), fetchMovements()]);
    renderApp(products, movements);
  } catch (err) {
    if (err instanceof NotAuthenticated) return renderLogin();
    renderUnavailable();
  }
}

/** Entry point: ask who we are, then show the shop, the login, or the unavailable state. */
async function boot(): Promise<void> {
  renderLoading();
  try {
    user = await fetchMe();
    if (user) await loadApp();
    else renderLogin();
  } catch {
    renderUnavailable(); // the backend could not be reached at all
  }
}

void boot();

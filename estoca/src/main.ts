import './styles.css';
import { fetchProducts, recordMovement, MovementRefused } from './api/client';
import type { ProductView } from './contract';

// The frontend no longer holds the source of truth or derives Stock: it reads the
// catalogue with its Stock from the backend over the contract, and records movements
// through it. Crossing a network boundary introduces failure modes localStorage never had
// — loading and unreachable-backend — so the UI now has explicit states for them.

const app = document.querySelector<HTMLDivElement>('#app')!;

function header(): string {
  return `
    <header>
      <h1>Estoca</h1>
      <p class="tagline">Control de stock en tiempo real — el stock nunca miente.</p>
    </header>`;
}

function renderLoading(): void {
  app.innerHTML = `${header()}<section class="panel"><p class="note">Cargando stock…</p></section>`;
}

function renderUnavailable(): void {
  app.innerHTML = `${header()}
    <section class="panel">
      <p class="error" role="alert">
        No pudimos cargar tu stock en este momento. Suele ser un problema temporal de
        conexión — <strong>tus datos están guardados, no se perdió nada.</strong>
        Revisá tu conexión a internet y reintentá en unos segundos. Si el problema sigue,
        escribinos a soporte.
      </p>
      <button id="retry" type="button">Reintentar</button>
    </section>`;
  document.querySelector<HTMLButtonElement>('#retry')!.addEventListener('click', load);
}

function renderApp(products: ProductView[]): void {
  app.innerHTML = `${header()}
    <section class="panel">
      <h2>Stock actual</h2>
      <table>
        <thead><tr><th>Product</th><th>Stock</th><th>Estado</th></tr></thead>
        <tbody>
          ${products
            .map((p) => {
              const badge = p.stockout
                ? '<span class="badge badge-out">Stockout</span>'
                : '<span class="badge badge-ok">OK</span>';
              return `<tr>
                <td>${p.name}</td>
                <td class="stock">${p.stock}</td>
                <td>${badge}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <p class="note">
        No existe forma de editar el Stock directamente. Solo se registra un movimiento
        — el Stock se deriva de la suma de los movimientos, en el backend.
      </p>
    </section>

    <section class="panel">
      <h2>Registrar movimiento</h2>
      <form id="movement-form">
        <label>Product
          <select name="productId">
            ${products.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        </label>
        <label>Tipo
          <select name="kind">
            <option value="entry">Entrada (+)</option>
            <option value="exit">Salida (−)</option>
          </select>
        </label>
        <label>Cantidad
          <input name="quantity" type="number" min="1" step="1" value="1" />
        </label>
        <label>Motivo
          <input name="reason" type="text" placeholder="Venta, compra, ajuste…" />
        </label>
        <button type="submit">Registrar</button>
      </form>
      <p id="error" class="error" role="alert"></p>
    </section>`;

  document.querySelector<HTMLFormElement>('#movement-form')!.addEventListener('submit', onSubmit);
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
    await load(); // re-read the truth from the backend
  } catch (err) {
    // A refused movement carries the backend's reason; anything else is a transport failure.
    errorEl.textContent =
      err instanceof MovementRefused
        ? err.message
        : 'No pudimos registrar el movimiento. Revisá tu conexión y probá de nuevo — no se guardó nada, así que podés reintentar sin duplicar.';
  }
}

async function load(): Promise<void> {
  renderLoading();
  try {
    renderApp(await fetchProducts());
  } catch {
    renderUnavailable();
  }
}

void load();

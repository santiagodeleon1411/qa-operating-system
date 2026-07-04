import './styles.css';
import { PRODUCTS, loadMovements, saveMovements } from './persistence';
import {
  stockOf,
  isStockout,
  makeMovement,
  wouldGoNegative,
  type MovementKind,
  type StockMovement,
} from './domain';

let movements: StockMovement[] = loadMovements();

const app = document.querySelector<HTMLDivElement>('#app')!;

function render(): void {
  app.innerHTML = `
    <header>
      <h1>Estoca</h1>
      <p class="tagline">Control de stock en tiempo real — el stock nunca miente.</p>
    </header>

    <section class="panel">
      <h2>Stock actual</h2>
      <table>
        <thead><tr><th>Product</th><th>Stock</th><th>Estado</th></tr></thead>
        <tbody>
          ${PRODUCTS.map((p) => {
            const stock = stockOf(p.id, movements);
            const out = isStockout(p, movements);
            const badge = out
              ? '<span class="badge badge-out">Stockout</span>'
              : '<span class="badge badge-ok">OK</span>';
            return `<tr>
              <td>${p.name}</td>
              <td class="stock">${stock}</td>
              <td>${badge}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p class="note">
        No existe forma de editar el Stock directamente. Solo se registra un movimiento
        — el Stock se deriva de la suma de los movimientos.
      </p>
    </section>

    <section class="panel">
      <h2>Registrar movimiento</h2>
      <form id="movement-form">
        <label>Product
          <select name="productId">
            ${PRODUCTS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}
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
    </section>
  `;

  document
    .querySelector<HTMLFormElement>('#movement-form')!
    .addEventListener('submit', onSubmit);
}

function onSubmit(e: SubmitEvent): void {
  e.preventDefault();
  const data = new FormData(e.currentTarget as HTMLFormElement);
  const errorEl = document.querySelector<HTMLParagraphElement>('#error')!;
  errorEl.textContent = '';

  try {
    const movement = makeMovement({
      productId: String(data.get('productId')),
      kind: String(data.get('kind')) as MovementKind,
      quantity: Number(data.get('quantity')),
      reason: String(data.get('reason') ?? ''),
      at: new Date().toISOString(),
    });

    if (wouldGoNegative(movement, movements)) {
      throw new Error('Una salida no puede dejar el Stock en negativo.');
    }

    movements = [...movements, movement];
    saveMovements(movements);
    render();
  } catch (err) {
    errorEl.textContent = err instanceof Error ? err.message : String(err);
  }
}

render();

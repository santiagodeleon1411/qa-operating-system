import { type Page, type Locator } from '@playwright/test';

// The Merchant's catalogue is seeded fixed by the schema (there is no way to create Products
// over the API), so a test picks one of these three to work with. Full names, because the
// screen renders them verbatim and we match rows by their visible text.
export const PRODUCTS = {
  cafe: 'Café molido 500g',
  yerba: 'Yerba mate 1kg',
  azucar: 'Azúcar 1kg',
} as const;

// The backend ids for those Products, needed when a test reaches PAST the screen to the API
// directly (e.g. to simulate a second device changing Stock mid-count). The screen speaks in
// names; the API speaks in ids.
export const PRODUCT_IDS = {
  cafe: 'p-cafe',
  yerba: 'p-yerba',
  azucar: 'p-azucar',
} as const;

// A Page Object: the ONE place that knows how Estoca's screen is built. Tests speak in terms
// of "record a movement" or "the Stock of the café"; only this class knows which selectors and
// form fields make that happen. When the UI changes, this file changes — not the tests.
export class EstocaPage {
  constructor(private readonly page: Page) {}

  /** Open the app without waiting for a particular state (used to observe the loading/error UI). */
  async open(): Promise<void> {
    await this.page.goto('/');
  }

  /** Open the app and wait until it is past the loading state, showing the shelf. */
  async goto(): Promise<void> {
    await this.open();
    await this.page.getByRole('heading', { name: 'Stock actual' }).waitFor();
  }

  /** The table row for a Product, located by its visible name. */
  private row(productName: string): Locator {
    return this.page.locator('tbody tr', { hasText: productName });
  }

  /** The Stock cell of a Product — used both to read a baseline and to assert on the result. */
  stockCell(productName: string): Locator {
    return this.row(productName).locator('td.stock');
  }

  /** The Stock a Product currently shows: the baseline a test measures its change against. */
  async stockOf(productName: string): Promise<number> {
    return Number(await this.stockCell(productName).innerText());
  }

  /** Record a movement through the "Registrar movimiento" form, as the Merchant would. */
  async recordMovement(opts: {
    product: string;
    kind: 'entry' | 'exit';
    quantity: number;
    reason: string;
  }): Promise<void> {
    const form = this.page.locator('#movement-form');
    await form.locator('select[name=productId]').selectOption({ label: opts.product });
    await form.locator('select[name=kind]').selectOption(opts.kind);
    await form.locator('input[name=quantity]').fill(String(opts.quantity));
    await form.locator('input[name=reason]').fill(opts.reason);
    await form.getByRole('button', { name: 'Registrar' }).click();
  }

  /** The inline error line under the movement form (empty when there is no error). */
  get movementError(): Locator {
    return this.page.locator('#error');
  }

  /** Reconcile a Product to a physical count through the "Ajustar por conteo físico" form. */
  async adjust(opts: { product: string; counted: number; reason: string }): Promise<void> {
    const form = this.page.locator('#adjust-form');
    await form.locator('select[name=productId]').selectOption({ label: opts.product });
    await form.locator('input[name=counted]').fill(String(opts.counted));
    await form.locator('select[name=reason]').selectOption(opts.reason);
    await form.getByRole('button', { name: 'Registrar ajuste' }).click();
  }

  /** The status line under the adjust form (staleness prompts and outcomes appear here). */
  get adjustMessage(): Locator {
    return this.page.locator('#adjust-msg');
  }

  /** The "Confirmar mi conteo" button shown only when the Stock changed during the count. */
  get reconfirmButton(): Locator {
    return this.page.getByRole('button', { name: 'Confirmar mi conteo' });
  }

  /** The unavailable-state alert shown when the backend cannot be reached. */
  get unavailableAlert(): Locator {
    return this.page.getByRole('alert');
  }

  /** The retry button offered by the unavailable state. */
  get retryButton(): Locator {
    return this.page.getByRole('button', { name: 'Reintentar' });
  }
}

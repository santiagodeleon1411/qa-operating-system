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

// The seeded users (src/users.ts) with their dev passwords. The whole app is behind a login
// now (ADR-0008), so a test authenticates before it can reach the shop.
export const LOGINS = {
  ana: { username: 'ana', password: 'estoca-ana', name: 'Ana' },
  bruno: { username: 'bruno', password: 'estoca-bruno', name: 'Bruno' },
  caro: { username: 'caro', password: 'estoca-caro', name: 'Caro' },
} as const;

// A Page Object: the ONE place that knows how Estoca's screen is built. Tests speak in terms
// of "log in", "record a movement" or "the Stock of the café"; only this class knows which
// selectors and form fields make that happen. When the UI changes, this file changes.
export class EstocaPage {
  constructor(private readonly page: Page) {}

  /** Open the app without waiting for a particular state (used to observe login/error UI). */
  async open(): Promise<void> {
    await this.page.goto('/');
  }

  /** Fill and submit the login form, without waiting for the shop (for the failure path). */
  async attemptLogin(username: string, password: string): Promise<void> {
    await this.open();
    const form = this.page.locator('#login-form');
    await form.locator('input[name=username]').fill(username);
    await form.locator('input[name=password]').fill(password);
    await form.getByRole('button', { name: 'Entrar' }).click();
  }

  /** Log in and wait until the shop is shown — what most tests do first. */
  async login(username: string, password: string): Promise<void> {
    await this.attemptLogin(username, password);
    await this.page.getByRole('heading', { name: 'Stock actual' }).waitFor();
  }

  /** The error line on the login form. */
  get loginError(): Locator {
    return this.page.locator('#login-error');
  }

  /** The "Conectado como …" line in the top bar. */
  get connectedAs(): Locator {
    return this.page.locator('.topbar');
  }

  async logout(): Promise<void> {
    await this.page.getByRole('button', { name: 'Salir' }).click();
  }

  /** The table row for a Product, located by its visible name. */
  private row(productName: string): Locator {
    return this.page.locator('tbody tr', { hasText: productName }).first();
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

  /** The most recent row of the movement history — where attribution becomes visible. */
  firstHistoryRow(): Locator {
    return this.page.locator('#history tr').first();
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

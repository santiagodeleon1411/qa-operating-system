import { test as base } from '@playwright/test';
import { EstocaPage } from './estoca-page';

// A fixture: shared setup handed to a test as an argument. Instead of every test building its
// own EstocaPage, it declares `{ estoca }` and Playwright constructs one, bound to that test's
// page, and tears it down afterwards. This is the reusable "recipe" — the tests stay isolated
// (each gets its own page) while the code to reach the screen lives in exactly one place.
export const test = base.extend<{ estoca: EstocaPage }>({
  estoca: async ({ page }, use) => {
    await use(new EstocaPage(page));
  },
});

export { expect } from '@playwright/test';

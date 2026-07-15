import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { EstocaPage, LOGINS, PRODUCTS } from './estoca-page';

// Route B — zero-tolerance design test (TC-23/24). The low-stock badge's look is a contract, not
// a suggestion. The mockup at docs/mockups/21-low-stock-threshold/badge.html is the design source
// of record; this test holds the LIVE badge's computed style to the MOCKUP's badge, token for
// token. Using the mockup itself as the oracle — rather than seven hand-copied literals — means
// the source of record stays the single truth: change the mockup and this test moves with it, and
// reading both badges through the same engine makes any normalisation cancel, so only a real
// divergence in the seven declared tokens can fail it.

const MOCKUP_URL = pathToFileURL(
  resolve('..', 'docs', 'mockups', '21-low-stock-threshold', 'badge.html'),
).href;

// The seven design tokens, read off the first low-stock badge on whichever page is loaded. All
// low-stock badges share the class, so their computed style is identical; the first is enough.
const readBadgeTokens = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(() => {
    const el = document.querySelector('.low-stock-badge');
    if (!el) throw new Error('no low-stock badge on the page');
    const s = getComputedStyle(el);
    return {
      backgroundColor: s.backgroundColor,
      color: s.color,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      padding: s.padding,
      borderRadius: s.borderRadius,
      letterSpacing: s.letterSpacing,
    };
  });

test('the low-stock badge matches the design source of record, token for token', async ({
  page,
}) => {
  // The oracle: the badge as drawn in the mockup.
  await page.goto(MOCKUP_URL);
  const expected = await readBadgeTokens(page);

  // The live badge in the running app. Force a Product below threshold so a badge is on screen,
  // independent of whatever Stock earlier tests left behind: at the maximum threshold, any real
  // Stock is at or below it. Wait for the PATCH re-render to settle (the input carries the saved
  // value, the badge reads Low stock) before snapshotting, so the read hits a stable node.
  const estoca = new EstocaPage(page);
  await estoca.login(LOGINS.ana.username, LOGINS.ana.password);
  await estoca.setThreshold(PRODUCTS.cafe, 10000);
  await expect(estoca.thresholdInput(PRODUCTS.cafe)).toHaveValue('10000');
  await expect(estoca.lowStockBadge(PRODUCTS.cafe)).toHaveText('Low stock');
  const actual = await readBadgeTokens(page);

  expect(actual).toEqual(expected);
});

import { expect, test, type Page } from '@playwright/test';
import { appURL, e2eConfig } from './support/e2e-config';
import { restoreUserAActiveLoan } from './support/e2e-db';
import { installSyntheticIsbnCamera } from './support/synthetic-isbn-camera';

const requestedDemoDelay = Number(process.env.E2E_DEMO_DELAY ?? '0');
const demoDelay = Number.isFinite(requestedDemoDelay) && requestedDemoDelay > 0
  ? requestedDemoDelay
  : 0;

async function pauseForHomeCheck(page: Page): Promise<void> {
  if (demoDelay > 0) {
    await page.waitForTimeout(Math.max(demoDelay, 2000));
  }
}

test.describe('返却', () => {
  test.use({ storageState: e2eConfig.authState.userA });

  test('ユーザーAが本を返却するとAのホームから消える', async ({
    page,
    context,
    browserName,
  }, testInfo) => {
    if (demoDelay > 0) {
      testInfo.setTimeout(120000);
    }

    test.skip(
      browserName !== 'chromium',
      '共有DBを更新する返却フローはChromiumで一度だけ実行する'
    );

    await restoreUserAActiveLoan(e2eConfig.books.returnableByA.isbn);

    await page.goto(appURL('/'));
    const borrowedSection = page.locator('#borrowed-books');
    await expect(
      borrowedSection.getByText(e2eConfig.books.returnableByA.title, {
        exact: true,
      })
    ).toBeVisible();
    await pauseForHomeCheck(page);

    await installSyntheticIsbnCamera(
      context,
      e2eConfig.books.returnableByA.isbn
    );
    await page.goto(appURL('/return'));
    await page.getByRole('button', { name: 'ISBN/JANを読み取る' }).click();

    await expect(
      page.getByText(e2eConfig.books.returnableByA.title, { exact: true })
    ).toBeVisible();
    await expect(page.getByText('この本を返却しますか？')).toBeVisible();

    await page.getByRole('button', { name: '返却する', exact: true }).click();
    await expect(page.getByText('返却が完了しました')).toBeVisible();

    await page.goto(appURL('/'));
    await expect(
      page
        .locator('#borrowed-books')
        .getByText(e2eConfig.books.returnableByA.title, { exact: true })
    ).toHaveCount(0);
    await pauseForHomeCheck(page);
  });

});

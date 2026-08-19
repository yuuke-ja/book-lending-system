import { expect, test, type Page } from '@playwright/test';
import {
  appURL,
  e2eConfig,
} from './support/e2e-config';
import { installSyntheticIsbnCamera } from './support/synthetic-isbn-camera';
import { resetAvailableBookLoan } from './support/e2e-db';

const requestedDemoDelay = Number(process.env.E2E_DEMO_DELAY ?? '0');
const demoDelay = Number.isFinite(requestedDemoDelay) && requestedDemoDelay > 0
  ? requestedDemoDelay
  : 0;

async function pauseForVisualCheck(page: Page): Promise<void> {
  if (demoDelay > 0) {
    await page.waitForTimeout(demoDelay);
  }
}

async function pauseForLoanPrivacyCheck(page: Page): Promise<void> {
  if (demoDelay > 0) {
    await page.waitForTimeout(Math.max(demoDelay, 2000));
  }
}

async function switchToUserB(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto(appURL('/e2e-login'));
  await expect(
    page.getByRole('heading', { name: 'E2Eテストログイン' })
  ).toBeVisible();
  await pauseForVisualCheck(page);

  await page
    .getByRole('button', {
      name: `${e2eConfig.users.userB.name}でログイン`,
    })
    .click();
  await expect(page).toHaveURL(appURL('/'));
  await expect(
    page.getByRole('img', { name: e2eConfig.users.userB.name }).first()
  ).toBeVisible();
  await pauseForVisualCheck(page);
}

test.use({ storageState: e2eConfig.authState.userA });

test('ユーザーAが借りた本はAのホームだけに表示される', async ({
  page,
  context,
  browserName,
}, testInfo) => {
  if (demoDelay > 0) {
    testInfo.setTimeout(120000);
  }

  test.skip(
    browserName !== 'chromium',
    '共有DBを更新する貸出フローはChromiumで一度だけ実行する'
  );

  await resetAvailableBookLoan();

  await installSyntheticIsbnCamera(
    context,
    e2eConfig.books.available.isbn
  );

  await page.goto(appURL('/loan/qr'));
  await pauseForVisualCheck(page);
  await page
    .getByRole('button', { name: 'ISBN/JANを読み取る' })
    .click();

  await expect(
    page.getByText(e2eConfig.books.available.title, { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('この本を貸し出しますか？')
  ).toBeVisible();
  await pauseForVisualCheck(page);

  await page.getByRole('button', { name: '借りる', exact: true }).click();
  await expect(page.getByText('貸出が完了しました')).toBeVisible();
  await pauseForVisualCheck(page);

  await test.step('ユーザーAのホームに貸出した本が表示される', async () => {
    await page.goto(appURL('/'));
    await expect(
      page.getByRole('img', { name: e2eConfig.users.userA.name }).first()
    ).toBeVisible();

    const userABorrowedSection = page.locator('#borrowed-books');
    await expect(
      userABorrowedSection.getByText(e2eConfig.books.available.title, {
        exact: true,
      })
    ).toBeVisible();
    await pauseForLoanPrivacyCheck(page);
  });

  await switchToUserB(page);
  await test.step('ユーザーBのホームにはAが借りた本が表示されない', async () => {
    const userBBorrowedSection = page.locator('#borrowed-books');
    await expect(
      userBBorrowedSection.getByText(e2eConfig.books.available.title, {
        exact: true,
      })
    ).toHaveCount(0);
    await pauseForLoanPrivacyCheck(page);
  });
});

test('ユーザーAの既存貸出本はユーザーBのホームに表示されない', async ({
  page,
}) => {
  await page.goto(appURL('/'));
  const userASection = page.locator('#borrowed-books');
  await expect(
    userASection.getByText(e2eConfig.books.borrowedByA.title, { exact: true })
  ).toBeVisible();
  await pauseForLoanPrivacyCheck(page);

  await switchToUserB(page);
  const userBSection = page.locator('#borrowed-books');
  await expect(
    userBSection.getByText(e2eConfig.books.borrowedByA.title, { exact: true })
  ).toHaveCount(0);
  await pauseForLoanPrivacyCheck(page);
});

import { expect, test } from '@playwright/test';
import {
  appURL,
  e2eConfig,
} from './support/e2e-config';
import { installSyntheticIsbnCamera } from './support/synthetic-isbn-camera';

test.use({ storageState: e2eConfig.authState.userA });

test('未登録のISBNを読み取るとユーザーにエラーを表示する', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    '疑似カメラ映像のWebKit差異は、カメラを対象外とするE2Eでは検証しない'
  );

  await installSyntheticIsbnCamera(context, e2eConfig.books.unregisteredIsbn);

  await page.goto(appURL('/loan/qr'));

  const dialogPromise = page.waitForEvent('dialog');
  await page
    .getByRole('button', { name: 'ISBN/JANを読み取る' })
    .click();
  const dialog = await dialogPromise;

  expect(dialog.message()).toBe('この本は未登録です');
  await dialog.accept();
});

test('貸出済みの本を借りようとすると重複貸出エラーを表示する', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    '疑似カメラ映像のWebKit差異は、カメラを対象外とするE2Eでは検証しない'
  );

  await installSyntheticIsbnCamera(
    context,
    e2eConfig.books.borrowedByA.isbn
  );

  await page.goto(appURL('/loan/qr'));
  await page
    .getByRole('button', { name: 'ISBN/JANを読み取る' })
    .click();
  await expect(
    page.getByText(e2eConfig.books.borrowedByA.title, { exact: true })
  ).toBeVisible();

  const dialogPromise = page.waitForEvent('dialog');
  await page.getByRole('button', { name: '借りる', exact: true }).click();
  const dialog = await dialogPromise;

  expect(dialog.message()).toBe('この本はすでに貸出中です');
  await dialog.accept();
});

test('貸出一覧APIが失敗するとホームに取得エラーを表示する', async ({
  page,
}) => {
  await page.route('**/api/book/loan', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'E2Eで意図的に発生させたエラー' }),
    });
  });

  await page.goto(appURL('/'));
  const borrowedSection = page.locator('#borrowed-books');
  await expect(
    borrowedSection.getByText('貸出中の本の取得に失敗しました')
  ).toBeVisible();
});

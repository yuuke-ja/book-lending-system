import { expect, test } from '@playwright/test';
import {
  appURL,
  e2eConfig,
} from './support/e2e-config';

test.use({ storageState: e2eConfig.authState.userA });

test('本一覧から本詳細を開き、登録情報を確認できる', async ({ page }) => {
  await page.goto(appURL('/book-list'));
  await page
    .getByRole('link', {
      name: `${e2eConfig.books.detail.title}の詳細ページを開く`,
    })
    .click();

  await expect(page).toHaveURL(
    appURL(`/book/${e2eConfig.books.detail.id}`)
  );
  const detailHeading = page.getByRole('heading', {
    level: 1,
    name: e2eConfig.books.detail.title,
  });
  await expect(detailHeading).toBeVisible();
  const detailContent = detailHeading.locator('..').locator('..');
  await expect(
    detailContent.getByText(e2eConfig.books.detail.author, { exact: true })
  ).toBeVisible();
  await expect(
    detailContent.getByText(
      `ISBN/JAN: ${e2eConfig.books.detail.isbn}`,
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    detailContent.getByText(e2eConfig.books.detail.description, {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    detailContent.getByText(`#${e2eConfig.books.detail.tag}`, { exact: true })
  ).toBeVisible();
});

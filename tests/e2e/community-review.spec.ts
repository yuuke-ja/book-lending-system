import { expect, test } from '@playwright/test';
import { appURL, e2eConfig } from './support/e2e-config';
import { resetCommunityReviewScenario } from './support/e2e-db';

const threadContent = 'いい本です';
const commentContent = 'そうだね\nこれもいいよ';

test.use({ storageState: e2eConfig.authState.userA });

test('本をレビューし、投稿と本を紐付けたコメントを保存できる', async ({
  page,
}) => {
  test.setTimeout(120000);
  await resetCommunityReviewScenario(threadContent);

  await page.goto(appURL('/'));
  await page.getByRole('link', { name: '本一覧' }).click();
  await page
    .getByRole('link', {
      name: `${e2eConfig.books.available.title}の詳細ページを開く`,
    })
    .click();

  await test.step('星3のレビューを保存する', async () => {
    await page.getByRole('button', { name: 'レビューする' }).click();
    await page.getByRole('radio', { name: 'Rate 3', exact: true }).click();
    await page.getByRole('button', { name: '送信', exact: true }).click();

    await expect(page.getByText('3.0', { exact: true })).toBeVisible();
    await expect(page.getByText('(1件)', { exact: true })).toBeVisible();
  });

  await test.step('本について投稿し、その投稿を開く', async () => {
    const threadInput = page.getByRole('textbox', {
      name: 'この本について投稿する',
    });
    await threadInput.fill(threadContent);
    await page
      .getByRole('button', {
        name: 'この本について投稿する',
        exact: true,
      })
      .click();

    const createdThread = page
      .getByRole('link')
      .filter({ hasText: threadContent })
      .first();
    await expect(createdThread).toBeVisible();
    await createdThread.click();
    await expect(
      page
        .locator('header')
        .filter({ hasText: 'THREAD' })
        .getByText(threadContent, { exact: true })
    ).toBeVisible();
  });

  await test.step('別の本を紐付けたコメントを保存する', async () => {
    const commentInput = page.getByRole('textbox', { name: 'コメントを書く' });
    await commentInput.fill(commentContent);
    await page.getByRole('button', { name: '本を紐付ける' }).click();
    await page
      .getByRole('link', {
        name: `${e2eConfig.books.detail.title}を選択`,
      })
      .click();

    await expect(commentInput).toHaveValue(commentContent);
    await expect(
      page.getByRole('button', { name: '本を選び直す' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'コメントする' }).click();

    await expect(page.getByText(commentContent, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: e2eConfig.books.detail.title })
    ).toBeVisible();
  });
});

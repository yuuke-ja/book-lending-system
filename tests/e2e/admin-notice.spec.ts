import { expect, test, type Locator, type Page } from '@playwright/test';
import { appURL, e2eConfig } from './support/e2e-config';
import { resetAdminNotice } from './support/e2e-db';

const noticeTitle = 'お知らせ';
const noticeContent = 'お知らせの詳細';

async function clickAndAcceptAlert(
  page: Page,
  button: Locator,
  expectedMessage: string
): Promise<void> {
  const dialogPromise = page.waitForEvent('dialog');
  const clickPromise = button.click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe(expectedMessage);
  await dialog.accept();
  await clickPromise;
}

test.use({ storageState: e2eConfig.authState.admin });

test('管理者がお知らせを登録し、利用者画面で確認して削除できる', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    '共有DBを更新する管理者操作はChromiumで一度だけ実行する'
  );
  test.setTimeout(120000);

  await resetAdminNotice(noticeTitle);

  await page.goto(appURL('/admin'));
  await page.getByRole('link', { name: 'お知らせ管理' }).click();
  await page.getByRole('textbox', { name: 'タイトル' }).fill(noticeTitle);
  await page.getByRole('textbox').nth(1).fill(noticeContent);

  await page.getByRole('button', { name: '本を選択' }).click();
  await page
    .getByRole('link', {
      name: `${e2eConfig.books.returnableByA.title}を選択`,
    })
    .click();

  await expect(
    page.getByRole('textbox', { name: 'タイトル' })
  ).toHaveValue(noticeTitle);
  await expect(page.getByRole('textbox').nth(1)).toHaveText(noticeContent);
  await expect(
    page
      .getByRole('main')
      .getByText(e2eConfig.books.returnableByA.title, { exact: true })
  ).toBeVisible();

  await clickAndAcceptAlert(
    page,
    page.getByRole('button', { name: '登録', exact: true }),
    'お知らせが保存されました'
  );

  await page.getByRole('link', { name: '管理者ページへ戻る' }).click();
  await page.getByRole('link', { name: 'トップページに戻る' }).click();

  const noticeButton = page
    .getByRole('button')
    .filter({ hasText: noticeTitle })
    .first();
  await expect(noticeButton).toBeVisible();
  await noticeButton.click();

  const noticeDialog = page.getByRole('dialog');
  await expect(
    noticeDialog.getByRole('heading', { name: noticeTitle })
  ).toBeVisible();
  await expect(
    noticeDialog.getByText(noticeContent, { exact: true })
  ).toBeVisible();

  await noticeDialog
    .getByRole('link')
    .filter({ hasText: e2eConfig.books.returnableByA.title })
    .click();
  await expect(page).toHaveURL(
    appURL(`/book/e2e-book-returnable-a`)
  );
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: e2eConfig.books.returnableByA.title,
    })
  ).toBeVisible();

  await page.getByRole('button', { name: '戻る' }).click();
  await page.getByRole('button', { name: 'お知らせを閉じる' }).click();
  await page.getByRole('link', { name: '管理者はこちら' }).click();
  await page.getByRole('link', { name: 'お知らせ管理' }).click();

  await page
    .getByRole('button', { name: `${noticeTitle}を削除` })
    .click();
  await expect(
    page.getByRole('button', { name: `${noticeTitle}を削除` })
  ).toHaveCount(0);
});

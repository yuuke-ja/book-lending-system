import { expect, test, type Locator, type Page } from '@playwright/test';
import { appURL, e2eConfig } from './support/e2e-config';
import { resetAdminTag } from './support/e2e-db';

const tagName = 'ユーザー';
const subterm = 'ユーザーA';

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

test('管理者がタグと小要素を追加して削除できる', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    '共有DBを更新する管理者操作はChromiumで一度だけ実行する'
  );
  test.setTimeout(120000);

  await resetAdminTag(tagName);

  await page.goto(appURL('/admin'));
  await page.getByRole('link', { name: 'タグ管理' }).click();
  await page.getByRole('textbox', { name: '追加するタグ名' }).fill(tagName);
  await clickAndAcceptAlert(
    page,
    page.getByRole('button', { name: 'まとめて追加' }),
    'タグを保存しました'
  );

  const tagRow = page
    .getByRole('row')
    .filter({
      has: page.getByRole('cell', { name: tagName, exact: true }),
    });
  await expect(tagRow).toBeVisible();
  await tagRow.getByRole('button', { name: '詳細' }).click();

  const tagDetails = page
    .getByRole('heading', { name: `タグ詳細: ${tagName}` })
    .locator('..');
  await tagDetails.getByRole('textbox', { name: 'SQL' }).fill(subterm);
  await clickAndAcceptAlert(
    page,
    tagDetails.getByRole('button', { name: 'まとめて追加' }),
    '小要素を保存しました'
  );
  await expect(tagDetails.getByText(subterm, { exact: true })).toBeVisible();

  const confirmPromise = page.waitForEvent('dialog');
  const deleteClickPromise = tagRow
    .getByRole('button', { name: '削除' })
    .click();
  const confirmation = await confirmPromise;
  expect(confirmation.message()).toBe(`${tagName}を削除しますか？`);
  await confirmation.accept();

  const deletedAlert = await page.waitForEvent('dialog');
  expect(deletedAlert.message()).toBe('タグを削除しました');
  await deletedAlert.accept();
  await deleteClickPromise;

  await expect(tagRow).toHaveCount(0);
});

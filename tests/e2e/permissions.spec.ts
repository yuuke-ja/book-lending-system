import { expect, test } from '@playwright/test';
import { appURL, e2eConfig } from './support/e2e-config';

test.describe('未ログイン', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('未ログインでは利用者画面を利用できない', async ({ page }) => {
    await page.goto(appURL('/'));
    await expect(
      page.getByRole('heading', { name: 'ログインが必要です' })
    ).toBeVisible();
  });
});

test.describe('一般ユーザー', () => {
  test.use({ storageState: e2eConfig.authState.userA });

  test('一般ユーザーは管理画面と管理APIを利用できない', async ({
    page,
    context,
  }) => {
    await page.goto(appURL('/admin'));
    await expect(page).toHaveURL(appURL('/'));
    await expect(
      page.getByRole('heading', { name: '管理者ダッシュボード' })
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: '管理者はこちら' })
    ).toHaveCount(0);

    const response = await context.request.get(appURL('/api/admin/tags'));
    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'アクセス権限がありません',
    });
  });
});

test.describe('管理者', () => {
  test.use({ storageState: e2eConfig.authState.admin });

  test('管理者は管理画面と管理APIを利用できる', async ({
    page,
    context,
  }) => {
    await page.goto(appURL('/admin'));
    await expect(
      page.getByRole('heading', { name: '管理者ダッシュボード' })
    ).toBeVisible();

    const response = await context.request.get(appURL('/api/admin/tags'));
    expect(response.status()).toBe(200);
    expect(Array.isArray(await response.json())).toBe(true);
  });
});

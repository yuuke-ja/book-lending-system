import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import {
  appURL,
  e2eConfig,
  e2eRoles,
} from './support/e2e-config';

setup('E2Eユーザー3種類のログイン状態を保存する', async ({ browser }) => {
  await mkdir(path.dirname(e2eConfig.authState.userA), { recursive: true });

  for (const role of e2eRoles) {
    const context = await browser.newContext({ baseURL: e2eConfig.baseURL });
    try {
      const page = await context.newPage();
      await page.goto(appURL('/e2e-login'));
      await page
        .getByRole('button', {
          name: `${e2eConfig.users[role].name}でログイン`,
        })
        .click();
      await expect(page).toHaveURL(appURL('/'));

      const sessionResponse = await context.request.get(
        appURL('/api/auth/session')
      );
      expect(sessionResponse.ok()).toBe(true);
      await expect(sessionResponse.json()).resolves.toMatchObject({
        user: { email: e2eConfig.users[role].email },
      });

      await context.storageState({ path: e2eConfig.authState[role] });
    } finally {
      await context.close();
    }
  }
});

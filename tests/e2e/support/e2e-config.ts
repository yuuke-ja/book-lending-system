import path from 'node:path';

type UserRole = 'userA' | 'userB' | 'admin';

function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

const authDirectory = path.resolve(
  env('E2E_AUTH_DIR', 'playwright/.auth')
);

/**
 * E2E環境が用意する固定データの契約。
 * 値は環境変数で差し替えられるため、seed側のIDや表示名を変更しても追従できる。
 * 貸出成功ケースでは曜日に左右されない貸出設定もseedしておくこと。
 */
export const e2eConfig = {
  baseURL: env('E2E_BASE_URL', 'http://localhost:3000'),
  users: {
    userA: {
      email: 'e2e-user-a@example.test',
      name: 'E2EユーザーA',
    },
    userB: {
      email: 'e2e-user-b@example.test',
      name: 'E2EユーザーB',
    },
    admin: {
      email: 'e2e-admin@example.test',
      name: 'E2E管理者',
    },
  },
  authState: {
    userA: path.join(authDirectory, 'user-a.json'),
    userB: path.join(authDirectory, 'user-b.json'),
    admin: path.join(authDirectory, 'admin.json'),
  },
  books: {
    available: {
      isbn: env('E2E_AVAILABLE_BOOK_ISBN', '9780000000002'),
      title: env('E2E_AVAILABLE_BOOK_TITLE', 'E2E貸出可能な本'),
    },
    borrowedByA: {
      isbn: env('E2E_BORROWED_BOOK_ISBN', '9780000000019'),
      title: env(
        'E2E_BORROWED_BOOK_TITLE',
        'E2EユーザーAが借りている本'
      ),
    },
    returnableByA: {
      isbn: env('E2E_RETURNABLE_BOOK_ISBN', '9780000000033'),
      title: env(
        'E2E_RETURNABLE_BOOK_TITLE',
        'E2EユーザーAが返却する本'
      ),
    },
    detail: {
      id: env('E2E_DETAIL_BOOK_ID', 'e2e-book-detail'),
      isbn: env('E2E_DETAIL_BOOK_ISBN', '9780000000026'),
      title: env('E2E_DETAIL_BOOK_TITLE', 'E2E詳細確認用の本'),
      author: env('E2E_DETAIL_BOOK_AUTHOR', 'テスト著者C'),
      description: env(
        'E2E_DETAIL_BOOK_DESCRIPTION',
        '本詳細画面を確認するための説明文です。'
      ),
      tag: env('E2E_DETAIL_BOOK_TAG', 'プログラミング'),
    },
    unregisteredIsbn: env('E2E_UNREGISTERED_ISBN', '9789999999991'),
  },
} as const;

export const e2eRoles = ['userA', 'userB', 'admin'] as const satisfies readonly UserRole[];

export function appURL(pathname: string): string {
  return new URL(pathname, `${e2eConfig.baseURL}/`).toString();
}

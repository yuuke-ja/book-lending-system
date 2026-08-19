This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## テスト

通常の単体・API・画面テストは次のコマンドで実行します。

```bash
npm test
```

PostgreSQLを使う結合テストは、Docker Desktopを起動してから次のコマンドで
実行します。

```bash
npm run test:db:up
npm run test:integration
npm run test:db:down
```

`test:integration`は`127.0.0.1:55432`のDockerテストDBへ固定接続します。
本番の`DATABASE_URL`は使用しません。初回起動時に`migrations/`を番号順に適用し、
本番と同じpublicスキーマを作成します。テスト本体は接続をread-onlyにしたうえで、
接続ごとに破棄される一時テーブルだけを更新します。

### E2Eテスト

Docker Desktopを起動した状態で、Playwrightの画面を見ながら実行できます。

```bash
npm run test:e2e:ui
```

画面を出さず全ブラウザーで実行する場合と、Chromiumを表示して操作を
ゆっくり自動実行する場合は次のコマンドを使います。

```bash
npm run test:e2e
npm run test:e2e:headed
```

これらのコマンドは、`127.0.0.1:55433/book_lending_e2e`のE2E専用DBを起動・
初期化し、Next.js開発サーバーとテスト専用ログインを自動で用意します。
通常DBと結合テスト用DBは使用しません。終了後に専用DBを停止する場合は
次を実行します。

```bash
npm run e2e:db:down
```

テスト専用ログインは、E2Eモード、開発環境、Vercel外、上記のローカル専用DB
という条件をすべて満たす場合にだけ有効になります。

## CSRF対策

Route Handlerでデータを変更するリクエストは、`proxy.ts`でブラウザの
`Origin`ヘッダーを検証します。開発中のlocalhostは自動的に許可されます。
本番環境では、公開するアプリのOriginをカンマ区切りで設定してください。

```bash
ALLOWED_ORIGINS=https://library.example.com
```

VercelのPreview URLと本番Deployment URLは、Vercelのシステム環境変数からも
取得します。独自ドメインは`ALLOWED_ORIGINS`への設定が必要です。

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

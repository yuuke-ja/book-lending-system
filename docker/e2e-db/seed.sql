DO $$
BEGIN
  IF current_database() <> 'book_lending_e2e' THEN
    RAISE EXCEPTION
      'E2E seed refused: expected book_lending_e2e, got %',
      current_database();
  END IF;
END
$$;

BEGIN;

TRUNCATE TABLE
  "AiChatMessage",
  "AiRecommendation",
  "BookEmbedding",
  "BookReview",
  "BookTag",
  "CommentBookLink",
  "GenrePointPrediction",
  "Loan",
  "LoanOpenPeriod",
  "Notice",
  "PushSubscription",
  "ResearchEvent",
  "SearchEventTag",
  "SearchEvent",
  "TagSubterm",
  "ThreadComment",
  "Thread",
  "UserRecommendation",
  "Admin",
  "PendingBook",
  "TagList",
  "LoanSettings",
  "Book",
  "User"
RESTART IDENTITY CASCADE;

INSERT INTO "User" (id, email, name, nickname)
VALUES
  ('e2e-user-a', 'e2e-user-a@example.test', 'E2EユーザーA', 'E2EユーザーA'),
  ('e2e-user-b', 'e2e-user-b@example.test', 'E2EユーザーB', 'E2EユーザーB'),
  ('e2e-admin', 'e2e-admin@example.test', 'E2E管理者', 'E2E管理者');

INSERT INTO "Admin" (email)
VALUES ('e2e-admin@example.test');

INSERT INTO "Book"
  (id, "googleBookId", isbn13, title, authors, description, thumbnail)
VALUES
  (
    'e2e-book-available',
    NULL,
    '9780000000002',
    'E2E貸出可能な本',
    ARRAY['テスト著者A'],
    '貸出操作を確認するための本です。',
    NULL
  ),
  (
    'e2e-book-borrowed-a',
    NULL,
    '9780000000019',
    'E2EユーザーAが借りている本',
    ARRAY['テスト著者B'],
    '利用者ごとの貸出表示を確認するための本です。',
    NULL
  ),
  (
    'e2e-book-detail',
    NULL,
    '9780000000026',
    'E2E詳細確認用の本',
    ARRAY['テスト著者C'],
    '本詳細画面を確認するための説明文です。',
    NULL
  ),
  (
    'e2e-book-returnable-a',
    NULL,
    '9780000000033',
    'E2EユーザーAが返却する本',
    ARRAY['テスト著者D'],
    '返却操作を確認するための本です。',
    NULL
  );

INSERT INTO "LoanSettings"
  ("settingKey", id, "fridayOnly", "loanPeriodDays")
VALUES ('default', 'e2e-loan-settings', false, 2);

INSERT INTO "Loan"
  (id, "userEmail", "bookId", "loanedAt", "dueAt")
VALUES
  (
    'e2e-loan-borrowed-a',
    'e2e-user-a@example.test',
    'e2e-book-borrowed-a',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP + INTERVAL '7 days'
  ),
  (
    'e2e-loan-returnable-a',
    'e2e-user-a@example.test',
    'e2e-book-returnable-a',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP + INTERVAL '7 days'
  );

INSERT INTO "TagList" (id, tag)
VALUES ('e2e-tag-programming', 'プログラミング');

INSERT INTO "BookTag" ("bookId", "tagId", source)
VALUES ('e2e-book-detail', 'e2e-tag-programming', 'manual');

COMMIT;

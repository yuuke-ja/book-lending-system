CREATE TABLE "Thread" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kind TEXT NOT NULL,
  "bookId" TEXT,
  "userEmail" TEXT NOT NULL,
  content TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Thread_bookId_fkey"
    FOREIGN KEY ("bookId")
    REFERENCES "Book"(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE TABLE "ThreadComment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "threadId" TEXT NOT NULL,
  "parentCommentId" TEXT,
  "userEmail" TEXT NOT NULL,
  content TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThreadComment_threadId_fkey"
    FOREIGN KEY ("threadId")
    REFERENCES "Thread"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "ThreadComment_parentCommentId_fkey"
    FOREIGN KEY ("parentCommentId")
    REFERENCES "ThreadComment"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);


CREATE TABLE "CommentBookLink" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "commentId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommentBookLink_commentId_fkey"
    FOREIGN KEY ("commentId")
    REFERENCES "ThreadComment"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "CommentBookLink_bookId_fkey"
    FOREIGN KEY ("bookId")
    REFERENCES "Book"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);


CREATE INDEX "Thread_bookId_idx"
  ON "Thread" ("bookId");

CREATE INDEX "Thread_createdAt_idx"
  ON "Thread" ("createdAt" DESC);

CREATE INDEX "ThreadComment_threadId_idx"
  ON "ThreadComment" ("threadId");

CREATE INDEX "ThreadComment_parentCommentId_idx"
  ON "ThreadComment" ("parentCommentId");

CREATE INDEX "ThreadComment_createdAt_idx"
  ON "ThreadComment" ("createdAt" ASC);

CREATE INDEX "CommentBookLink_commentId_idx"
  ON "CommentBookLink" ("commentId");

CREATE INDEX "CommentBookLink_bookId_idx"
  ON "CommentBookLink" ("bookId");

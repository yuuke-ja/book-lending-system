ALTER TABLE "LoanSettings"
ADD COLUMN IF NOT EXISTS "settingKey" TEXT;


WITH canonical AS (
  SELECT id
  FROM "LoanSettings"
  ORDER BY "createdAt" ASC, id ASC
  LIMIT 1
)
UPDATE "LoanOpenPeriod" op
SET "loanSettingsId" = canonical.id
FROM canonical
WHERE op."loanSettingsId" <> canonical.id;

WITH canonical AS (
  SELECT id
  FROM "LoanSettings"
  ORDER BY "createdAt" ASC, id ASC
  LIMIT 1
)
DELETE FROM "LoanSettings" ls
USING canonical
WHERE ls.id <> canonical.id;

UPDATE "LoanSettings"
SET "settingKey" = 'default'
WHERE "settingKey" IS DISTINCT FROM 'default';

ALTER TABLE "LoanSettings"
ALTER COLUMN "settingKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "LoanSettings_settingKey_key"
  ON "LoanSettings" ("settingKey");

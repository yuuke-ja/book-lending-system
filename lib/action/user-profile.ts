"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ProfileInput = {
  nickname?: unknown;
  avatarUrl?: unknown;
};

type UpdateUserProfileResult =
  | { ok: true; status: 200; message: string }
  | { ok: false; status: 400 | 401 | 500; error: string };

export async function updateUserProfile(
  input: unknown
): Promise<UpdateUserProfileResult> {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return { ok: false, status: 401, error: "認証が必要です" };
  }

  if (typeof input !== "object" || input === null) {
    return { ok: false, status: 400, error: "更新項目がありません" };
  }

  const body = input as ProfileInput;
  const hasNickname = Object.prototype.hasOwnProperty.call(body, "nickname");
  const hasAvatarUrl = Object.prototype.hasOwnProperty.call(body, "avatarUrl");

  if (!hasNickname && !hasAvatarUrl) {
    return { ok: false, status: 400, error: "更新項目がありません" };
  }

  if (hasNickname && typeof body.nickname !== "string") {
    return { ok: false, status: 400, error: "nicknameが不正です" };
  }

  if (hasAvatarUrl && typeof body.avatarUrl !== "string") {
    return { ok: false, status: 400, error: "avatarUrlが不正です" };
  }

  try {
    if (hasNickname && hasAvatarUrl) {
      await db.query(
        `UPDATE "User"
         SET nickname = $1,
             avatarurl = $2
         WHERE email = $3`,
        [body.nickname, body.avatarUrl, userEmail]
      );
    } else if (hasNickname) {
      await db.query(
        `UPDATE "User"
         SET nickname = $1
         WHERE email = $2`,
        [body.nickname, userEmail]
      );
    } else {
      await db.query(
        `UPDATE "User"
         SET avatarurl = $1
         WHERE email = $2`,
        [body.avatarUrl, userEmail]
      );
    }

    return {
      ok: true,
      status: 200,
      message: "プロフィールが更新されました",
    };
  } catch (error) {
    console.error("プロフィールの更新に失敗:", error);
    return {
      ok: false,
      status: 500,
      error: "プロフィールの更新に失敗しました",
    };
  }
}

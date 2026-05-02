import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) {
        return "/banpage";
      }

      // 一時的に学校メールアドレス制限を外す。
      // if (
      //   !user.email ||
      //   (!user.email.endsWith("@nnn.ed.jp") &&
      //     !user.email.endsWith("@nnn.ac.jp"))
      // ) {
      //   return "/banpage";
      // }

      await db.query(
        `INSERT INTO "User" (email)
         VALUES ($1)
         ON CONFLICT (email) DO NOTHING`,
        [user.email]
      );

      return true;
    },
  },
  trustHost: true,
});

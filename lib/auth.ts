import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import {
  isE2ETestMode,
  isE2EUserEmail,
} from "@/lib/e2e-environment";

const e2eTestMode = isE2ETestMode();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          prompt: "consent select_account",
        },
      },
    }),
    ...(e2eTestMode
      ? [
        Credentials({
          id: "e2e",
          name: "E2E Test Login",
          credentials: {
            email: { label: "Email", type: "email" },
          },
          async authorize(credentials) {
            const email =
              typeof credentials.email === "string"
                ? credentials.email.toLowerCase()
                : "";
            if (!isE2EUserEmail(email)) return null;

            const result = await db.query<{
              id: string;
              email: string;
              name: string | null;
            }>(
              `SELECT id, email, name
                 FROM "User"
                 WHERE email = $1
                 LIMIT 1`,
              [email]
            );
            const user = result.rows[0];
            return user
              ? { id: user.id, email: user.email, name: user.name }
              : null;
          },
        }),
      ]
      : []),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) {
        return "/banpage";
      }

      if (e2eTestMode) {
        return isE2EUserEmail(user.email);
      }
      const emailDomain = user.email.split("@")[1];

      if (
        !emailDomain ||
        (emailDomain !== process.env.USER_EMAIL_DOMAIN &&
          emailDomain !== process.env.ADMIN_EMAIL_DOMAIN)
      ) {
        return "/banpage";
      }

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

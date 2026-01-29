import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // .env.local の環境変数を利用
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email && user.email.endsWith("@nnn.ed.jp")) {
        return true;
      }
      return false;
    },
  },
  // Vercel などプロキシ環境向け
  trustHost: true,
  // 必要に応じて callbacks や pages などをここに追加
})

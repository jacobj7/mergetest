import NextAuth, { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.userId = token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as any).accessToken = token.accessToken;
        (session as any).userId = token.userId ?? token.sub;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);

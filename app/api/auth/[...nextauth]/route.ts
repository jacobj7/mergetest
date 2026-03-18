import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { Pool } from "pg";
import type { NextAuthOptions } from "next-auth";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function ensureTablesExist() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        github_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        login VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        github_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255),
        image TEXT,
        login VARCHAR(255),
        access_token TEXT,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

async function upsertOrganization(org: {
  github_id: string;
  name: string;
  login: string;
  avatar_url?: string;
}) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      INSERT INTO organizations (github_id, name, login, avatar_url, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (github_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        login = EXCLUDED.login,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
      RETURNING id
      `,
      [org.github_id, org.name, org.login, org.avatar_url || null],
    );
    return result.rows[0]?.id || null;
  } finally {
    client.release();
  }
}

async function upsertUser(user: {
  github_id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  login?: string | null;
  access_token?: string | null;
  organization_id?: number | null;
}) {
  const client = await pool.connect();
  try {
    await client.query(
      `
      INSERT INTO users (github_id, name, email, image, login, access_token, organization_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (github_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        image = EXCLUDED.image,
        login = EXCLUDED.login,
        access_token = EXCLUDED.access_token,
        organization_id = EXCLUDED.organization_id,
        updated_at = NOW()
      `,
      [
        user.github_id,
        user.name || null,
        user.email || null,
        user.image || null,
        user.login || null,
        user.access_token || null,
        user.organization_id || null,
      ],
    );
  } finally {
    client.release();
  }
}

async function fetchUserOrganizations(accessToken: string) {
  try {
    const response = await fetch("https://api.github.com/user/orgs", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const orgs = await response.json();
    return orgs;
  } catch {
    return [];
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email read:org",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "github") {
        return false;
      }

      try {
        await ensureTablesExist();

        const githubProfile = profile as {
          id?: number;
          login?: string;
          avatar_url?: string;
          email?: string;
        };

        const githubId = String(githubProfile?.id || user.id);
        const login = githubProfile?.login || null;
        const accessToken = account.access_token || null;

        let organizationId: number | null = null;

        if (accessToken) {
          const orgs = await fetchUserOrganizations(accessToken);

          if (orgs && orgs.length > 0) {
            const primaryOrg = orgs[0];
            organizationId = await upsertOrganization({
              github_id: String(primaryOrg.id),
              name: primaryOrg.login,
              login: primaryOrg.login,
              avatar_url: primaryOrg.avatar_url,
            });
          }
        }

        await upsertUser({
          github_id: githubId,
          name: user.name,
          email: user.email,
          image: user.image,
          login,
          access_token: accessToken,
          organization_id: organizationId,
        });

        return true;
      } catch (error) {
        console.error("Error during sign-in persistence:", error);
        return true;
      }
    },

    async jwt({ token, account, profile }) {
      if (account?.provider === "github") {
        token.accessToken = account.access_token;

        const githubProfile = profile as {
          id?: number;
          login?: string;
        };

        if (githubProfile?.id) {
          token.githubId = String(githubProfile.id);
        }

        if (githubProfile?.login) {
          token.login = githubProfile.login;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }

      if (token.githubId) {
        session.user = {
          ...session.user,
          githubId: token.githubId as string,
        };
      }

      if (token.login) {
        session.user = {
          ...session.user,
          login: token.login as string,
        };
      }

      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

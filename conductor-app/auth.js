import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db } from "./lib/db";
import { upsertAuthenticatedUser } from "./lib/authUserProvisioning.js";
import {
  allowFirstUserAdmin,
  getAuthTrustHost,
  validateProductionSecurityEnv,
} from "./lib/productionSecurity.js";

validateProductionSecurityEnv();

const providers = [];
const e2eAuthEnabled = process.env.NODE_ENV !== "production" && process.env.E2E_TEST_AUTH === "true";

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  );
}

if (e2eAuthEnabled) {
  providers.push(
    Credentials({
      id: "e2e",
      name: "E2E OAuth simulator",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      authorize(credentials) {
        const configuredEmail = (process.env.E2E_TEST_EMAIL || "e2e-admin@example.com").toLowerCase();
        const email = String(credentials?.email || "").trim().toLowerCase();
        if (email !== configuredEmail) {
          return null;
        }
        return { id: `e2e:${email}`, email, name: "E2E Administrator" };
      },
    })
  );
}

const adminEmails = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret: process.env.AUTH_SECRET,
  trustHost: getAuthTrustHost(),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const dbUser = await upsertAuthenticatedUser(user, {
        database: db,
        adminEmails,
        allowFirstUserAdmin,
      });
      return Boolean(dbUser && dbUser.status !== "DISABLED");
    },
    async jwt({ token }) {
      if (token.email) {
        const dbUser = await db.user.findUnique({
          where: { email: token.email.toLowerCase() },
        });
        if (dbUser) {
          await db.user.update({
            where: { id: dbUser.id },
            data: { lastSeenAt: new Date() },
          });
          token.dbUserId = dbUser.id;
          token.role = dbUser.role;
          token.status = dbUser.status;
          token.name = dbUser.name || token.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.dbUserId;
        session.user.role = token.role;
        session.user.status = token.status;
      }
      return session;
    },
  },
});

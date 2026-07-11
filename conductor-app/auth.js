import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { db } from "./lib/db";
import {
  allowFirstUserAdmin,
  getAuthTrustHost,
  validateProductionSecurityEnv,
} from "./lib/productionSecurity.js";

validateProductionSecurityEnv();

const providers = [];

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

const adminEmails = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

async function upsertAuthenticatedUser(profile) {
  const email = profile?.email?.trim().toLowerCase();
  if (!email) {
    return null;
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  const userCount = existingUser ? 1 : await db.user.count();
  const shouldBeAdmin = adminEmails.has(email) || (userCount === 0 && allowFirstUserAdmin());
  const role = existingUser?.role || (shouldBeAdmin ? "ADMIN" : "USER");
  const status = existingUser?.status || (shouldBeAdmin ? "ACTIVE" : "PENDING");

  return db.user.upsert({
    where: { email },
    update: {
      name: profile.name || existingUser?.name || null,
      role,
      ...(shouldBeAdmin ? { status: "ACTIVE" } : {}),
    },
    create: {
      email,
      name: profile.name || null,
      role,
      status,
    },
  });
}

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
      const dbUser = await upsertAuthenticatedUser(user);
      return Boolean(dbUser && dbUser.status !== "DISABLED");
    },
    async jwt({ token }) {
      if (token.email) {
        const dbUser = await db.user.findUnique({
          where: { email: token.email.toLowerCase() },
        });
        if (dbUser) {
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

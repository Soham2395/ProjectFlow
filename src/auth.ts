import { type AuthOptions, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { encrypt } from "@/lib/crypto";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  // Temporarily use JWT sessions to bypass DB session writes while debugging
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[auth] credentials authorize: user not found or no password for', email);
          }
          throw new Error('Invalid email or password');
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[auth] credentials authorize: invalid password for', email);
          }
          throw new Error('Invalid email or password');
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: (user as any).image ?? null,
        } as any;
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      // Request repo scopes for private repo access when user consents
      authorization: {
        params: { scope: "repo read:org" },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // Persist GitHub access token securely on first sign-in or when refreshed
      try {
        if (account?.provider === "github" && account.access_token) {
          const userId = (user as any)?.id || (token as any)?.sub;
          if (userId) {
            const { ciphertext, iv, tag } = encrypt(account.access_token);
            await prisma.gitHubToken.upsert({
              where: { userId },
              update: {
                encryptedAccessToken: ciphertext,
                iv,
                authTag: tag,
                tokenType: account.token_type ?? null,
                scope: account.scope ?? null,
                expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
              },
              create: {
                userId,
                encryptedAccessToken: ciphertext,
                iv,
                authTag: tag,
                tokenType: account.token_type ?? null,
                scope: account.scope ?? null,
                expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
              },
            });
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.error("[auth] Failed to persist GitHub token:", e);
        }
      }
      return token;
    },
    // Update the session with the user's ID. With JWT strategy, use token.sub.
    async session({ session, token, user }) {
      if (session.user) {
        const id = (user as any)?.id || (token as any)?.sub || session.user.id;
        session.user.id = id as string;
        // If user is present on first login, prefer its fields; else keep existing.
        session.user.name = (user as any)?.name ?? session.user.name ?? null;
        session.user.email = (user as any)?.email ?? session.user.email ?? null;
        session.user.image = (user as any)?.image ?? (session.user as any)?.image ?? null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Use the callbackUrl if it exists, otherwise redirect to dashboard
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return baseUrl + '/dashboard';
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  // Enable debug logs in development
  debug: process.env.NODE_ENV === 'development',
};
import type { NextAuthConfig } from "next-auth";
import { isSuperAdminRole } from "@/lib/roles";

/**
 * The session settings shared by sign-in (auth.ts) and middleware.ts.
 *
 * Kept free of Prisma and bcrypt: middleware only reads the session cookie,
 * and importing auth.ts there bundled both (with Prisma's query engine) into
 * the middleware that runs on every request. auth.ts adds the password
 * provider on top of this.
 */
export const authConfig = {
  providers: [],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const appUser = user as typeof user & { role?: string };

        token.id = user.id;
        // A super admin works as an admin everywhere, so the session carries
        // "admin" and the extra Base Price access rides on isSuperAdmin.
        token.isSuperAdmin = isSuperAdminRole(appUser.role);
        token.role = token.isSuperAdmin ? "admin" : appUser.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as typeof session.user & {
          id?: string;
          role?: string;
          isSuperAdmin?: boolean;
        };

        sessionUser.id = token.id as string;
        sessionUser.role = token.role as string;
        sessionUser.isSuperAdmin = token.isSuperAdmin === true;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;

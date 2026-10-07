import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        const role = credentials?.role;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        // Emails are stored trimmed and lowercased, so the lookup has to match
        // that or a stray space / capital letter fails an otherwise valid login.
        const normalizedEmail = email.trim().toLowerCase();

        const users = await prisma.user.findMany({
          where: { email: normalizedEmail },
        });

        if (users.length === 0) {
          return null;
        }

        const matchingUsers = [];

        for (const user of users) {
          const passwordMatches = await bcrypt.compare(password, user.password);

          if (passwordMatches) {
            matchingUsers.push(user);
          }
        }

        if (matchingUsers.length === 0) {
          return null;
        }

        const user =
          typeof role === "string" && role
            ? matchingUsers.find((candidate) => candidate.role === role)
            : matchingUsers.length === 1
              ? matchingUsers[0]
              : null;

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
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
});

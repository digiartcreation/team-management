import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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

        // An inactive employee cannot sign in (see the Employees page).
        const users = await prisma.user.findMany({
          where: { email: normalizedEmail, isActive: true },
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
});

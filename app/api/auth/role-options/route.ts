import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SUPER_ADMIN } from "@/lib/roles";

function getRoleLabel(role: string) {
  if (role === SUPER_ADMIN) return "Super Admin Dashboard";
  if (role === "admin") return "Admin Dashboard";
  if (role === "manager") return "Manager Dashboard";
  return "Employee Dashboard";
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ roles: [] }, { status: 400 });
  }

  const email =
    body && typeof body === "object" && "email" in body
      ? (body as { email?: unknown }).email
      : "";
  const password =
    body && typeof body === "object" && "password" in body
      ? (body as { password?: unknown }).password
      : "";
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPassword = typeof password === "string" ? password : "";

  if (!normalizedEmail || !normalizedPassword) {
    return NextResponse.json({ roles: [] });
  }

  try {
    const users = await prisma.user.findMany({
      where: { email: normalizedEmail },
      select: {
        id: true,
        role: true,
        password: true,
        isActive: true,
      },
    });

    const roles = [];
    let inactive = false;

    for (const user of users) {
      if (await bcrypt.compare(normalizedPassword, user.password)) {
        // The right password on an inactive account: the login page says
        // so, rather than calling the password wrong.
        if (!user.isActive) {
          inactive = true;
          continue;
        }

        roles.push({
          role: user.role,
          label: getRoleLabel(user.role),
        });
      }
    }

    return NextResponse.json(
      roles.length === 0 && inactive ? { roles, inactive: true } : { roles }
    );
  } catch {
    return NextResponse.json({ roles: [] }, { status: 500 });
  }
}

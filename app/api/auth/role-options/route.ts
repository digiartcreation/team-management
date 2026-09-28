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
  const normalizedEmail = typeof email === "string" ? email.trim() : "";
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
      },
    });

    const roles = [];

    for (const user of users) {
      if (await bcrypt.compare(normalizedPassword, user.password)) {
        roles.push({
          role: user.role,
          label: getRoleLabel(user.role),
        });
      }
    }

    return NextResponse.json({ roles });
  } catch {
    return NextResponse.json({ roles: [] }, { status: 500 });
  }
}

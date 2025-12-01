import { NextResponse } from "next/server";
import { deriveStaffCookieValue } from "@/lib/staffAuth";

const COOKIE_NAME = "staff_auth";
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = (body?.password as string | undefined) ?? "";
  const secret = process.env.STAFF_PASS;

  if (!secret) {
    return NextResponse.json(
      { error: "STAFF_PASS is not configured." },
      { status: 500 },
    );
  }

  if (password !== secret) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const cookieValue = await deriveStaffCookieValue(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}

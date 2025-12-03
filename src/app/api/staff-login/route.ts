import { NextResponse } from "next/server";
import { deriveStaffCookieValue } from "@/lib/staffAuth";

const COOKIE_NAME = "staff_auth";
const SESSION_COOKIE_NAME = "__session"; // forwarded by Firebase Hosting/Cloud Run
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
  const common = {
    value: cookieValue,
    httpOnly: true,
    sameSite: "none" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
  // Primary cookie for client-side checks (if needed).
  res.cookies.set({ ...common, name: COOKIE_NAME });
  // Duplicate as __session so Firebase Hosting/Cloud Run forwards it to middleware.
  res.cookies.set({ ...common, name: SESSION_COOKIE_NAME });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}

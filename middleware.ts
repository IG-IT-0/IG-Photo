import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { deriveStaffCookieValue } from "@/lib/staffAuth";

const PROTECTED_PATHS = ["/photographer", "/assistant"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const shouldProtect = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path),
  );

  if (!shouldProtect) return NextResponse.next();

  const staffPass = process.env.STAFF_PASS;
  if (staffPass) {
    const expectedCookie = await deriveStaffCookieValue(staffPass);
    const authed = req.cookies.get("staff_auth")?.value === expectedCookie;
    if (authed) return NextResponse.next();
  }

  const loginUrl = new URL("/staff-login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/photographer/:path*", "/assistant/:path*"],
};

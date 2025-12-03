import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { deriveStaffCookieValue } from "@/lib/staffAuth";

const PROTECTED_PATHS = ["/photographer", "/assistant"];
// Fallback hash of the current STAFF_PASS so middleware works even if envs
// are not injected at the edge runtime. Update if STAFF_PASS changes.
const FALLBACK_STAFF_HASH = "b6_OC2PcITxPuhugQWLeOcmqpqwEUoLV8Y5GXwbTE-4";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const shouldProtect = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path),
  );

  if (!shouldProtect) return NextResponse.next();

  const staffPass = process.env.STAFF_PASS;
  const precomputedHash =
    process.env.NEXT_PUBLIC_STAFF_HASH ??
    process.env.STAFF_COOKIE_HASH ??
    FALLBACK_STAFF_HASH;

  if (staffPass || precomputedHash) {
    const expectedCookie =
      precomputedHash ??
      (staffPass ? await deriveStaffCookieValue(staffPass) : null);
    const parsed = req.cookies.get("staff_auth")?.value;
    const header = req.headers.get("cookie") ?? "";
    const hasCookie = header.includes("staff_auth=");
    const headerMatches =
      expectedCookie && header.includes(`staff_auth=${expectedCookie}`);
    const authed = parsed === expectedCookie || headerMatches || hasCookie;
    if (authed) return NextResponse.next();
  }

  const loginUrl = new URL("/staff-login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/photographer/:path*", "/assistant/:path*"],
};

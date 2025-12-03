import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { deriveStaffCookieValue } from "@/lib/staffAuth";

const PROTECTED_PATHS = ["/photographer", "/assistant"];
// Fallback hash of the current STAFF_PASS so middleware works even if envs
// are not injected at the edge runtime. Update if STAFF_PASS changes.
const FALLBACK_STAFF_HASH = "b6_OC2PcITxPuhugQWLeOcmqpqwEUoLV8Y5GXwbTE-4";
const SESSION_COOKIE_NAME = "__session";
const STAFF_COOKIE_NAME = "staff_auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const shouldProtect = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path),
  );

  if (!shouldProtect) {
    const res = NextResponse.next();
    res.headers.set("x-middleware-cache", "no-cache");
    return res;
  }

  const staffPass = process.env.STAFF_PASS;
  const precomputedHash =
    process.env.NEXT_PUBLIC_STAFF_HASH ??
    process.env.STAFF_COOKIE_HASH ??
    FALLBACK_STAFF_HASH;

  if (staffPass || precomputedHash) {
    const expectedCookie =
      precomputedHash ??
      (staffPass ? await deriveStaffCookieValue(staffPass) : null);
    const parsed =
      req.cookies.get(STAFF_COOKIE_NAME)?.value ??
      req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const header = req.headers.get("cookie") ?? "";
    const hasCookie =
      header.includes(`${STAFF_COOKIE_NAME}=`) ||
      header.includes(`${SESSION_COOKIE_NAME}=`);
    const headerMatches =
      expectedCookie &&
      (header.includes(`${STAFF_COOKIE_NAME}=${expectedCookie}`) ||
        header.includes(`${SESSION_COOKIE_NAME}=${expectedCookie}`));
    const authed = parsed === expectedCookie || headerMatches || hasCookie;
    const debug = {
      path: pathname,
      expectedSnippet: expectedCookie?.slice(0, 8) ?? null,
      parsedSnippet: parsed?.slice(0, 8) ?? null,
      hasCookie,
      headerMatches,
      authed,
      usingPrecomputed: Boolean(precomputedHash),
    };
    console.log("[middleware/staff]", JSON.stringify(debug));
    if (authed) {
      const res = NextResponse.next();
      res.headers.set("x-staff-debug", JSON.stringify(debug));
      res.headers.set("x-middleware-cache", "no-cache");
      return res;
    }
  }

  const loginUrl = new URL("/staff-login", req.url);
  loginUrl.searchParams.set("next", pathname);
  const redirect = NextResponse.redirect(loginUrl);
  redirect.headers.set(
    "x-staff-debug",
    JSON.stringify({
      path: pathname,
      expected: Boolean(precomputedHash || staffPass),
      cookiePresent: req.headers.get("cookie") ?? null,
    }),
  );
  redirect.headers.set("cache-control", "private, no-store");
  redirect.headers.set("x-middleware-cache", "no-cache");
  return redirect;
}

export const config = {
  matcher: ["/photographer/:path*", "/assistant/:path*"],
};

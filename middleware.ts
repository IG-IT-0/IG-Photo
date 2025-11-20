import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_PATHS = ["/photographer", "/assistant"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const shouldProtect = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path),
  );

  if (!shouldProtect) return NextResponse.next();

  const authed = req.cookies.get("staff_auth")?.value === "1";
  if (authed) return NextResponse.next();

  const loginUrl = new URL("/staff-login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/photographer/:path*", "/assistant/:path*"],
};

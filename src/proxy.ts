import { type NextRequest, NextResponse } from "next/server";

const locales = ["fr", "en"] as const;
const defaultLocale = "fr";

function getLocale(request: NextRequest): string {
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  for (const part of acceptLanguage.split(",")) {
    const lang = part.trim().split(";")[0].split("-")[0].toLowerCase();
    if ((locales as readonly string[]).includes(lang)) return lang;
  }
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) =>
      pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) return;

  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)" ],
};

import { NextResponse } from "next/server";
import { randomToken, CSRF_COOKIE } from "@/lib/utils";

export async function GET() {
  const token = randomToken(24);
  const res = NextResponse.json({ csrf: token });
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}

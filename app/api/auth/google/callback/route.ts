import { type NextRequest, NextResponse } from "next/server"
import {
  COOKIE_AT,
  COOKIE_EXP,
  COOKIE_RT,
  COOKIE_STATE,
  exchangeCodeForTokens,
  getOrigin,
  getCookie,
  setCookie,
  clearCookie,
} from "@/lib/google-oauth"

export async function GET(req: NextRequest) {
  const origin = getOrigin(req)
  const { searchParams } = req.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const storedState = await getCookie(COOKIE_STATE)

  if (!code) {
    return new NextResponse("Missing code", { status: 400 })
  }
  if (!state || !storedState || state !== storedState) {
    return new NextResponse("Invalid state", { status: 400 })
  }

  try {
    const t = await exchangeCodeForTokens(code, origin)
    // set cookies
    await setCookie(COOKIE_AT, t.access_token, t.expires_in)
    if (t.refresh_token) await setCookie(COOKIE_RT, t.refresh_token)
    await setCookie(COOKIE_EXP, String(Math.floor(Date.now() / 1000) + t.expires_in), t.expires_in)
    await clearCookie(COOKIE_STATE)
    return NextResponse.redirect(new URL("/", origin))
  } catch (e: any) {
    return new NextResponse(e?.message || "OAuth callback error", { status: 500 })
  }
}

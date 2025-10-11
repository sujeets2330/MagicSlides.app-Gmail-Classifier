import { type NextRequest, NextResponse } from "next/server"
import { COOKIE_AT, COOKIE_EXP, COOKIE_RT, getCookie, setCookie, refreshAccessToken } from "@/lib/google-oauth"
import { fetchEmails } from "@/lib/gmail"

export async function GET(req: NextRequest) {
  const maxParam = req.nextUrl.searchParams.get("max")
  const max = Math.max(1, Math.min(50, Number(maxParam || 15))) // cap to 50 for safety

  let accessToken = await getCookie(COOKIE_AT)
  const refreshToken = await getCookie(COOKIE_RT)
  const exp = Number((await getCookie(COOKIE_EXP)) || 0)
  const now = Math.floor(Date.now() / 1000)

  if (!accessToken && !refreshToken) {
    return new NextResponse("Not authenticated", { status: 401 })
  }

  // refresh if expiring within 60s
  if (refreshToken && (!accessToken || exp - now < 60)) {
    try {
      const t = await refreshAccessToken(refreshToken)
      accessToken = t.access_token
      await setCookie(COOKIE_AT, t.access_token, t.expires_in)
      await setCookie(COOKIE_EXP, String(Math.floor(Date.now() / 1000) + t.expires_in), t.expires_in)
    } catch (e: any) {
      return new NextResponse(e?.message || "Failed to refresh token", { status: 401 })
    }
  }

  try {
    const emails = await fetchEmails(accessToken as string, max)
    return NextResponse.json({ emails })
  } catch (e: any) {
    return new NextResponse(e?.message || "Failed to fetch emails", { status: 500 })
  }
}

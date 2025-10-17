import { NextResponse, type NextRequest } from "next/server"
import { COOKIE_STATE, getAuthUrl, getOrigin, setCookie } from "@/lib/google-oauth"

export async function GET(req: NextRequest) {
  const origin = getOrigin(req)
  const state = crypto.randomUUID()
  await setCookie(COOKIE_STATE, state, 600) // 10 minutes
  const url = getAuthUrl(origin, state)
  return NextResponse.redirect(url)
}
 
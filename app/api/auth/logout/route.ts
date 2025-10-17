import { NextResponse } from "next/server"
import { clearCookie, COOKIE_AT, COOKIE_EXP, COOKIE_RT } from "@/lib/google-oauth"

export async function POST() {
  await clearCookie(COOKIE_AT)
  await clearCookie(COOKIE_RT)
  await clearCookie(COOKIE_EXP)
  return new NextResponse(null, { status: 204 })
}
 
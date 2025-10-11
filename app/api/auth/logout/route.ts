import { NextResponse } from "next/server"
import { clearCookie, COOKIE_AT, COOKIE_EXP, COOKIE_RT } from "@/lib/google-oauth"

export async function POST() {
  clearCookie(COOKIE_AT)
  clearCookie(COOKIE_RT)
  clearCookie(COOKIE_EXP)
  return new NextResponse(null, { status: 204 })
}

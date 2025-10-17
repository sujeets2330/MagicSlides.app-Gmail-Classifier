import { NextResponse } from "next/server"
import { COOKIE_AT } from "@/lib/google-oauth"
import { cookies } from "next/headers"

export async function GET() {
  const c = await cookies()
  const at = c.get(COOKIE_AT)?.value
  return NextResponse.json({ authenticated: Boolean(at) })
}
 
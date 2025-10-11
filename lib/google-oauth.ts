 import { cookies } from "next/headers"
import type { NextRequest } from "next/server"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

export function getRedirectUri(origin: string) {
  return `${origin}/api/auth/google/callback`
}

export function getAuthUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: getRedirectUri(origin),
    response_type: "code",
    scope: ["https://www.googleapis.com/auth/gmail.readonly", "openid", "email", "profile"].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string, origin: string) {
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: getRedirectUri(origin),
    grant_type: "authorization_code",
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Token exchange failed: ${t}`)
  }
  const data = await res.json()
  return data as {
    access_token: string
    expires_in: number
    refresh_token?: string
    id_token?: string
    token_type: string
    scope: string
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Token refresh failed: ${t}`)
  }
  const data = await res.json()
  return data as { access_token: string; expires_in: number; token_type: string; scope?: string }
}

export function getOrigin(req: NextRequest) {
  // Use NextRequest URL origin; fallback to header if needed
  return req.nextUrl.origin
}

// Cookie helpers
export const COOKIE_AT = "ga_at"
export const COOKIE_RT = "ga_rt"
export const COOKIE_EXP = "ga_exp"
export const COOKIE_STATE = "ga_state"

export async function setCookie(name: string, value: string, maxAgeSeconds?: number) {
  const c = await cookies()
  c.set(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    ...(maxAgeSeconds ? { maxAge: maxAgeSeconds } : {}),
  })
}

export async function clearCookie(name: string) {
  const c = await cookies()
  c.set(name, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 })
}

export async function getCookie(name: string) {
  const c = await cookies()
  return c.get(name)?.value
}

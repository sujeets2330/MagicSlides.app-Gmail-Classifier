import { type NextRequest, NextResponse } from "next/server"; 
import {  // app/api/gmail/fetch/route.ts - THIS IS SERVER-SIDE
  COOKIE_AT,
  COOKIE_EXP,
  COOKIE_RT,
  getCookie,
  setCookie,
  refreshAccessToken,
} from "@/lib/google-oauth";
import { fetchEmails } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  try {
    const maxParam = req.nextUrl.searchParams.get("max");
    const max = Math.max(1, Math.min(50, Number(maxParam || 15)));

    console.log("Fetching emails, max:", max);

    let accessToken = await getCookie(COOKIE_AT);
    const refreshToken = await getCookie(COOKIE_RT);
    const exp = Number((await getCookie(COOKIE_EXP)) || 0);
    const now = Math.floor(Date.now() / 1000);

    if (!accessToken && !refreshToken) {
      console.error("No authentication tokens found");
      return NextResponse.json(
        { error: "Not authenticated. Please log in again." },
        { status: 401 }
      );
    }

    if (refreshToken && (!accessToken || exp - now < 60)) {
      console.log("Refreshing access token...");
      try {
        const t = await refreshAccessToken(refreshToken);
        accessToken = t.access_token;
        await setCookie(COOKIE_AT, t.access_token, t.expires_in);
        await setCookie(
          COOKIE_EXP,
          String(Math.floor(Date.now() / 1000) + t.expires_in),
          t.expires_in
        );
        console.log("Access token refreshed successfully");
      } catch (e: any) {
        console.error("Token refresh failed:", e.message);
        return NextResponse.json(
          { error: "Failed to refresh access token. Please log in again." },
          { status: 401 }
        );
      }
    }

    try {
      console.log("Fetching emails from Gmail API...");
      const emails = await fetchEmails(accessToken as string, max);
      console.log(`Successfully fetched ${emails.length} emails`);
      return NextResponse.json({ emails });
    } catch (e: any) {
      console.error("Fetch emails error:", e.message);
      return NextResponse.json(
        { error: `Failed to fetch emails: ${e.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Gmail fetch route error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
type GmailMessageList = { messages?: { id: string; threadId: string }[] }
type GmailMessage = {
  id: string
  internalDate?: string
  snippet?: string
  payload?: {
    mimeType?: string
    filename?: string
    body?: { data?: string }
    parts?: GmailMessage["payload"][]
    headers?: { name: string; value: string }[]
  }
}

export type EmailItem = {
  id: string
  from?: string
  subject?: string
  snippet?: string
  bodyText?: string
  date?: string
}

export async function listMessageIds(accessToken: string, max: number) {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages")
  url.searchParams.set("maxResults", String(max))
  url.searchParams.set("q", "") // last X messages overall
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gmail list failed: ${t}`)
  }
  const data = (await res.json()) as GmailMessageList
  return (data.messages || []).map((m) => m.id)
}

export async function getMessage(accessToken: string, id: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gmail message fetch failed: ${t}`)
  }
  const data = (await res.json()) as GmailMessage
  return data
}

export async function fetchEmails(accessToken: string, max: number): Promise<EmailItem[]> {
  const ids = await listMessageIds(accessToken, max)
  const items = await Promise.all(
    ids.map(async (id) => {
      const msg = await getMessage(accessToken, id)
      const headers = msg.payload?.headers || []
      const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value
      const from = headers.find((h) => h.name.toLowerCase() === "from")?.value
      const date = headers.find((h) => h.name.toLowerCase() === "date")?.value
      const bodyText = extractText(msg.payload)
      const snippet = msg.snippet
      return { id: msg.id, from, subject, date, snippet, bodyText }
    }),
  )
  return items
}

function extractText(payload: GmailMessage["payload"]): string | undefined {
  if (!payload) return undefined
  if (payload.mimeType?.startsWith("text/plain") && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.mimeType?.startsWith("text/html") && payload.body?.data) {
    const html = decodeBase64Url(payload.body.data)
    return stripHtml(html)
  }
  if (payload.parts && payload.parts.length > 0) {
    for (const p of payload.parts) {
      const text = extractText(p)
      if (text) return text
    }
  }
  return undefined
}

function decodeBase64Url(data: string): string {
  // Gmail uses URL-safe base64
  const s = data.replace(/-/g, "+").replace(/_/g, "/")
  try {
    // atob works in Next.js
    return typeof atob !== "undefined"
      ? decodeURIComponent(escape(atob(s)))
      : Buffer.from(s, "base64").toString("utf-8")
  } catch {
    return ""
  }
}

function stripHtml(html: string): string {
  // naive strip for classification purposes
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

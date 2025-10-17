export type GmailMessageList = {
  messages?: { id: string; threadId: string }[];
};

type GmailMessage = {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: {
    mimeType?: string;
    filename?: string;
    body?: { data?: string };
    parts?: GmailMessage["payload"][];
    headers?: { name: string; value: string }[];
  };
};

export type EmailItem = {
  id: string;
  from?: string;
  subject?: string;
  snippet?: string;
  bodyText?: string;
  date?: string;
};

// 🔹 Step 1: Fetch message IDs
export async function listMessageIds(accessToken: string, max: number) {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("maxResults", String(max));
  url.searchParams.set("q", ""); // fetch latest mails

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail list failed: ${t}`);
  }

  const data = (await res.json()) as GmailMessageList;
  return (data.messages || []).map((m) => m.id);
}

// 🔹 Step 2: Fetch each message by ID
export async function getMessage(accessToken: string, id: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail message fetch failed: ${t}`);
  }

  return (await res.json()) as GmailMessage;
}

// 🔹 Step 3: Fetch and extract email details
export async function fetchEmails(accessToken: string, max: number): Promise<EmailItem[]> {
  const ids = await listMessageIds(accessToken, max);

  const items = await Promise.all(
    ids.map(async (id) => {
      const msg = await getMessage(accessToken, id);
      const headers = msg.payload?.headers || [];

      const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value;
      const from = headers.find((h) => h.name.toLowerCase() === "from")?.value;
      const date = headers.find((h) => h.name.toLowerCase() === "date")?.value;
      const snippet = msg.snippet || "";

      const bodyText = extractText(msg.payload);

      return { id: msg.id, from, subject, date, snippet, bodyText };
    })
  );

  return items;
}

// 🔹 Step 4: Extract text from nested MIME parts
function extractText(payload?: GmailMessage["payload"]): string {
  if (!payload) return "";

  // Plain text
  if (payload.mimeType?.includes("text/plain") && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // HTML text (convert to plain)
  if (payload.mimeType?.includes("text/html") && payload.body?.data) {
    return stripHtml(decodeBase64Url(payload.body.data));
  }

  // Recursively check nested parts
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      const text = extractText(part);
      if (text) return text;
    }
  }

  return "";
}

// 🔹 Step 5: Decode Gmail's Base64 safely
function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return typeof atob !== "undefined"
      ? decodeURIComponent(escape(atob(normalized)))
      : Buffer.from(normalized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

// 🔹 Step 6: Strip HTML for clean classification input
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
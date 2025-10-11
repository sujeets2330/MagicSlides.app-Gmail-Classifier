import { type NextRequest, NextResponse } from "next/server"
import { AllowedCategories, normalizeCategory } from "@/lib/categories"
import { ChatOpenAI } from "@langchain/openai"

type EmailInput = {
  id: string
  from?: string
  subject?: string
  snippet?: string
  bodyText?: string
}

export async function POST(req: NextRequest) {
  const { emails, openaiKey } = (await req.json()) as {
    emails: EmailInput[]
    openaiKey: string
  }

  if (!openaiKey || typeof openaiKey !== "string") {
    return new NextResponse("Missing OpenAI key", { status: 400 })
  }
  if (!Array.isArray(emails) || emails.length === 0) {
    return new NextResponse("No emails provided", { status: 400 })
  }

  const model = new ChatOpenAI({
    apiKey: openaiKey,
    model: "gpt-4o-mini", // GPT-4o family as requested
    temperature: 0,
  })

  // Build a simple, robust prompt per email to return exactly one category.
  async function classifyOne(e: EmailInput): Promise<string> {
    const content = [
      `You are an email classifier. Choose the single best category for the email from this exact set: ${AllowedCategories.join(", ")}.`,
      `Return only the category text. No extra words.`,
      `Definitions:`,
      `- Important: Personal or work-related and may require attention.`,
      `- Promotions: Sales, discounts, marketing campaigns.`,
      `- Social: From social networks, friends, or family.`,
      `- Marketing: Marketing, newsletters, notifications.`,
      `- Spam: Unwanted or unsolicited emails.`,
      `- General: If none match above.`,
      `Email:`,
      `From: ${e.from || "Unknown"}`,
      `Subject: ${e.subject || "(No Subject)"}`,
      `Snippet: ${e.snippet || ""}`,
      `Body: ${(e.bodyText || "").slice(0, 1200)}`,
      `Category:`,
    ].join("\n")

    const res = await model.invoke([{ role: "user", content }])
    return (res.content as any)?.trim?.() ?? "General"
  }

  try {
    // Simple concurrency
    const pairs = await Promise.all(
      emails.map(async (e) => {
        const raw = await classifyOne(e)
        const cat = normalizeCategory(String(raw))
        return [e.id, cat] as const
      }),
    )

    const classifications: Record<string, string> = {}
    for (const [id, cat] of pairs) classifications[id] = cat

    return NextResponse.json({ classifications })
  } catch (e: any) {
    return new NextResponse(e?.message || "Classification error", { status: 500 })
  }
}

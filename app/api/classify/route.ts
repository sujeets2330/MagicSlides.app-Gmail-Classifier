import { type NextRequest, NextResponse } from "next/server";
import { normalizeCategory } from "@/lib/categories";
import { ChatOpenAI } from "@langchain/openai";

type EmailInput = {
  id: string;
  from?: string;
  subject?: string;
  snippet?: string;
  bodyText?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { emails } = await req.json() as { 
      emails: EmailInput[]; 
    };

    console.log("Classification request received for", emails?.length, "emails");

    // Use environment variable for OpenAI key directly
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      console.error("Missing OpenAI API key in environment variables");
      return NextResponse.json(
        { error: "OpenAI API key not configured on server. Please check your .env file." },
        { status: 500 }
      );
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      console.error("No emails provided");
      return NextResponse.json(
        { error: "No emails provided for classification" },
        { status: 400 }
      );
    }

    console.log("Initializing OpenAI model with environment key...");
    const model = new ChatOpenAI({
      apiKey: openaiKey,
      model: "gpt-4o-mini",
      temperature: 0,
      maxTokens: 10,
    });

    async function classifyOne(e: EmailInput): Promise<string> {
      const prompt = `Classify this email into exactly one of these categories: Important, Promotions, Social, Marketing, Spam, General.

From: ${e.from || "Unknown"}
Subject: ${e.subject || "No Subject"}
Preview: ${e.snippet || "No preview"}
Body: ${(e.bodyText || "No body").substring(0, 500)}

ONLY respond with the category name.`;

      try {
        console.log(`Classifying email: ${e.id.substring(0, 10)}...`);
        const res = await model.invoke([{ role: "user", content: prompt }]);
        const raw = (res.content as any)?.trim?.() ?? "General";
        const category = normalizeCategory(raw);
        console.log(`Email ${e.id.substring(0, 10)}... classified as: ${category}`);
        return category;
      } catch (error: any) {
        console.error(`Classification error for email ${e.id}:`, error.message);
        return "General";
      }
    }

    // Process emails in smaller batches to avoid rate limits
    const batchSize = 3;
    const pairs: [string, string][] = [];
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(emails.length/batchSize)}`);
      
      const batchResults = await Promise.all(
        batch.map(async (e) => [e.id, await classifyOne(e)] as const)
      );
      pairs.push(...batchResults);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < emails.length) {
        console.log("Waiting 1 second before next batch...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const classifications: Record<string, string> = {};
    
    for (const [id, cat] of pairs) {
      classifications[id] = cat;
    }

    console.log("Classification completed successfully");
    return NextResponse.json({ classifications });
  } catch (error: any) {
    console.error("Classification route error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
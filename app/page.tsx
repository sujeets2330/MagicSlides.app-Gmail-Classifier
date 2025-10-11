"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type EmailItem = {
  id: string
  from?: string
  subject?: string
  snippet?: string
  bodyText?: string
  date?: string
}

type Category = "Important" | "Promotions" | "Social" | "Marketing" | "Spam" | "General"

const ALL_CATEGORIES: Category[] = ["Important", "Promotions", "Social", "Marketing", "Spam", "General"]

const LS_KEYS = {
  emails: "ms_emails",
  openaiKey: "ms_openai_key",
  lastClassifications: "ms_classifications",
  maxResults: "ms_max_results",
}

export default function HomePage() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
  const [openaiKey, setOpenaiKey] = useState("")
  const [maxResults, setMaxResults] = useState<number>(15)
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [classifications, setClassifications] = useState<Record<string, Category>>({})
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All")
  const [loadingFetch, setLoadingFetch] = useState(false)
  const [loadingClassify, setLoadingClassify] = useState(false)

  useEffect(() => {
    const storedKey = localStorage.getItem(LS_KEYS.openaiKey)
    if (storedKey) setOpenaiKey(storedKey)

    const storedEmails = localStorage.getItem(LS_KEYS.emails)
    if (storedEmails) {
      try {
        setEmails(JSON.parse(storedEmails))
      } catch {}
    }

    const storedClass = localStorage.getItem(LS_KEYS.lastClassifications)
    if (storedClass) {
      try {
        setClassifications(JSON.parse(storedClass))
      } catch {}
    }

    const storedMax = localStorage.getItem(LS_KEYS.maxResults)
    if (storedMax) {
      const n = Number(storedMax)
      if (!Number.isNaN(n) && n > 0) setMaxResults(n)
    }
    // Check auth session
    ;(async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" })
        const data = await res.json()
        setIsAuthed(Boolean(data?.authenticated))
      } catch {
        setIsAuthed(false)
      }
    })()
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_KEYS.maxResults, String(maxResults))
  }, [maxResults])

  const filteredEmails = useMemo(() => {
    if (activeCategory === "All") return emails
    return emails.filter((e) => classifications[e.id] === activeCategory)
  }, [emails, classifications, activeCategory])

  const categoryCounts = useMemo(() => {
    const map: Record<Category, number> = {
      Important: 0,
      Promotions: 0,
      Social: 0,
      Marketing: 0,
      Spam: 0,
      General: 0,
    }
    for (const id of Object.keys(classifications)) {
      const cat = classifications[id]
      if (map[cat] !== undefined) map[cat] += 1
    }
    return map
  }, [classifications])

  async function startLogin() {
    window.location.href = "/api/auth/google/start"
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    setIsAuthed(false)
  }

  function saveKey() {
    localStorage.setItem(LS_KEYS.openaiKey, openaiKey.trim())
    alert("OpenAI API key saved to localStorage.")
  }

  async function onFetchEmails() {
    setLoadingFetch(true)
    try {
      const res = await fetch(`/api/gmail/fetch?max=${encodeURIComponent(maxResults)}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || "Failed to fetch emails")
      }
      const data = (await res.json()) as { emails: EmailItem[] }
      setEmails(data.emails)
      localStorage.setItem(LS_KEYS.emails, JSON.stringify(data.emails))
    } catch (e: any) {
      alert(e?.message || "Error fetching emails")
    } finally {
      setLoadingFetch(false)
    }
  }

  async function onClassify() {
    if (!openaiKey.trim()) {
      alert("Please enter your OpenAI API key first.")
      return
    }
    if (emails.length === 0) {
      alert("No emails to classify. Fetch emails first.")
      return
    }
    setLoadingClassify(true)
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openaiKey: openaiKey.trim(),
          emails: emails.map((e) => ({
            id: e.id,
            from: e.from,
            subject: e.subject,
            snippet: e.snippet,
            bodyText: e.bodyText,
          })),
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || "Failed to classify emails")
      }
      const data = (await res.json()) as {
        classifications: Record<string, Category>
      }
      setClassifications(data.classifications)
      localStorage.setItem(LS_KEYS.lastClassifications, JSON.stringify(data.classifications))
    } catch (e: any) {
      alert(e?.message || "Error classifying emails")
    } finally {
      setLoadingClassify(false)
    }
  }

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-balance text-2xl font-semibold">MagicSlides.app — Gmail Classifier</h1>
          <div className="flex items-center gap-3">
            {isAuthed ? (
              <Button variant="secondary" onClick={logout}>
                Logout
              </Button>
            ) : (
              <Button onClick={startLogin}>Login with Google</Button>
            )}
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>OpenAI Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter your OpenAI API key. It will be stored in your browser&apos;s localStorage.
              </p>
              <Input
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
              <Button onClick={saveKey}>Save Key</Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Fetch Emails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="max" className="text-sm">
                    X (default 15):
                  </label>
                  <Input
                    id="max"
                    type="number"
                    min={1}
                    value={maxResults}
                    onChange={(e) => setMaxResults(Math.max(1, Number(e.target.value)))}
                    className="w-24"
                  />
                </div>
                <Button onClick={onFetchEmails} disabled={!isAuthed || loadingFetch}>
                  {loadingFetch ? "Fetching…" : "Fetch Last X Emails"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={onClassify}
                  disabled={loadingClassify || emails.length === 0 || !openaiKey.trim()}
                >
                  {loadingClassify ? "Classifying…" : "Classify Emails"}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <FilterPill
                  label="All"
                  active={activeCategory === "All"}
                  onClick={() => setActiveCategory("All")}
                  count={emails.length}
                />
                {ALL_CATEGORIES.map((c) => (
                  <FilterPill
                    key={c}
                    label={c}
                    active={activeCategory === c}
                    onClick={() => setActiveCategory(c)}
                    count={categoryCounts[c]}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="mt-8 grid gap-4">
          {filteredEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {emails.length === 0
                ? "No emails yet. Log in with Google and fetch your emails."
                : "No emails in this category."}
            </p>
          ) : null}
          {filteredEmails.map((e) => {
            const cat = classifications[e.id]
            return (
              <Card key={e.id}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-pretty text-base">{e.subject || "(No Subject)"}</CardTitle>
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-xs",
                      cat ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {cat || "Unclassified"}
                  </span>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">From:</span> {e.from || "Unknown"}
                    {" • "}
                    <span className="font-medium">Date:</span> {e.date ? new Date(e.date).toLocaleString() : "Unknown"}
                  </div>
                  {e.snippet ? <p className="text-sm">{e.snippet}</p> : null}
                </CardContent>
              </Card>
            )
          })}
        </section>
      </div>
    </main>
  )
}

function FilterPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm",
        active ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
      )}
      aria-pressed={active}
    >
      {label}
      {typeof count === "number" ? <span className="ml-2 opacity-80">({count})</span> : null}
    </button>
  )
}

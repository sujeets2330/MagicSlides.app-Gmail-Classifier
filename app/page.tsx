"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmailItem = {
  id: string;
  from?: string;
  subject?: string;
  snippet?: string;
  bodyText?: string;
  date?: string;
};

type Category = "Important" | "Promotions" | "Social" | "Marketing" | "Spam" | "General";

const ALL_CATEGORIES: Category[] = ["Important", "Promotions", "Social", "Marketing", "Spam", "General"];

const LS_KEYS = {
  emails: "ms_emails",
  openaiKey: "ms_openai_key",
  lastClassifications: "ms_classifications",
  maxResults: "ms_max_results",
};

export default function HomePage() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [maxResults, setMaxResults] = useState(15);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [classifications, setClassifications] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [loadingClassify, setLoadingClassify] = useState(false);
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);

  useEffect(() => {
    const storedEmails = localStorage.getItem(LS_KEYS.emails);
    if (storedEmails) setEmails(JSON.parse(storedEmails));
    
    const storedClass = localStorage.getItem(LS_KEYS.lastClassifications);
    if (storedClass) setClassifications(JSON.parse(storedClass));
    
    const storedMax = localStorage.getItem(LS_KEYS.maxResults);
    if (storedMax) setMaxResults(Number(storedMax));

    // Check if OpenAI key exists in localStorage
    const storedOpenAIKey = localStorage.getItem(LS_KEYS.openaiKey);
    setHasOpenAIKey(!!storedOpenAIKey);

    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json();
        setIsAuthed(Boolean(data?.authenticated));
      } catch {
        setIsAuthed(false);
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.maxResults, String(maxResults));
  }, [maxResults]);

  const filteredEmails = useMemo(() => {
    if (activeCategory === "All") return emails;
    return emails.filter((e) => classifications[e.id] === activeCategory);
  }, [emails, classifications, activeCategory]);

  const categoryCounts = useMemo(() => {
    const map: Record<Category, number> = {
      Important: 0,
      Promotions: 0,
      Social: 0,
      Marketing: 0,
      Spam: 0,
      General: 0,
    };
    
    for (const id of Object.keys(classifications)) {
      const cat = classifications[id] as Category;
      if (map[cat] !== undefined) map[cat] += 1;
    }
    
    return map;
  }, [classifications]);

  async function startLogin() {
    window.location.href = "/api/auth/google/start";
  }

  async function logout() {
    // Only clear authentication, keep all localStorage data
    await fetch("/api/auth/logout", { method: "POST" });
    setIsAuthed(false);
    setActiveCategory("All");
    // Don't clear emails, classifications, or OpenAI key from state or localStorage
  }

  function saveKey() {
  // Check if key already exists
  if (hasOpenAIKey) {
    alert("OpenAI key is already saved in localStorage!");
    return;
  }

  // Check if emails exist in localStorage
  const storedEmails = localStorage.getItem(LS_KEYS.emails);
  const emailsExist = storedEmails && JSON.parse(storedEmails).length > 0;

  if (!emailsExist) {
    alert("No emails found in localStorage. Fetch emails first before saving key.");
    return;
  }

  const demoKey = "sk-demo-key-saved-to-localstorage";
  localStorage.setItem(LS_KEYS.openaiKey, demoKey);
  setHasOpenAIKey(true);
  alert("OpenAI API key saved to localStorage!");
}

  function deleteLocalStorage() {
    // Check if emails exist in localStorage
    const storedEmails = localStorage.getItem(LS_KEYS.emails);
    const emailsExist = storedEmails && JSON.parse(storedEmails).length > 0;

    if (!emailsExist) {
      alert("No emails found in localStorage to delete.");
      return;
    }

    if (confirm("Are you sure you want to delete all localStorage data? This will remove all saved emails and classifications.")) {
      localStorage.removeItem(LS_KEYS.emails);
      localStorage.removeItem(LS_KEYS.lastClassifications);
      localStorage.removeItem(LS_KEYS.openaiKey);
      localStorage.removeItem(LS_KEYS.maxResults);
      
      setEmails([]);
      setClassifications({});
      setHasOpenAIKey(false);
      setMaxResults(15);
      
      alert("All localStorage data has been cleared.");
    }
  }

  async function onFetchEmails() {
    if (!isAuthed) {
      alert("Please log in first");
      return;
    }

    setLoadingFetch(true);
    
    try {
      const res = await fetch(`/api/gmail/fetch?max=${maxResults}`, { cache: "no-store" });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to fetch emails" }));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setEmails(data.emails || []);
      localStorage.setItem(LS_KEYS.emails, JSON.stringify(data.emails || []));
      setClassifications({});
      localStorage.removeItem(LS_KEYS.lastClassifications);
      
      if (data.emails && data.emails.length > 0) {
        alert(`Successfully fetched ${data.emails.length} emails`);
      } else {
        alert("No emails found in your inbox");
      }
    } catch (e: any) {
      console.error("Fetch emails error:", e);
      alert(`Error fetching emails: ${e.message}`);
    } finally {
      setLoadingFetch(false);
    }
  }

  async function onClassify() {
    if (emails.length === 0) {
      alert("No emails to classify. Fetch emails first.");
      return;
    }

    setLoadingClassify(true);
    
    try {
      console.log("Starting classification for", emails.length, "emails");

      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: emails.map((e) => ({
            id: e.id,
            from: e.from || "",
            subject: e.subject || "",
            snippet: e.snippet || "",
            bodyText: e.bodyText || "",
          })),
        }),
      });
      
      console.log("Classification response status:", res.status);
      
      if (!res.ok) {
        let errorMessage = `HTTP error! status: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          const errorText = await res.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const data = await res.json();
      console.log("Classification success:", data);
      
      if (!data.classifications) {
        throw new Error("No classifications returned from server");
      }
      
      setClassifications(data.classifications);
      localStorage.setItem(LS_KEYS.lastClassifications, JSON.stringify(data.classifications));
      
      const classifiedCount = Object.keys(data.classifications).length;
      alert(`Successfully classified ${classifiedCount} emails`);
    } catch (e: any) {
      console.error("Classification error:", e);
      alert(`Error classifying emails: ${e.message}`);
    } finally {
      setLoadingClassify(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">MagicSlides.app — Gmail Classifier</h1>
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
          {/* Left Side - OpenAI Key Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>OpenAI Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter your OpenAI API key. It will be stored in your browser's localStorage.
              </p>
              <div className="p-3 border rounded-md bg-muted/50">
                <p className="text-sm font-mono text-muted-foreground">
                  {hasOpenAIKey ? "sk-••••••••••" : "No OpenAI key configured"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveKey} className="flex-1">
                  Save Key
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={deleteLocalStorage}
                  className="flex-1"
                >
                  Delete Data
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>LocalStorage:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Emails: {emails.length}</li>
                  <li>• Classified: {Object.keys(classifications).length}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Right Side - Fetch & Classify Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Fetch Emails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="max" className="text-sm">
                  X (default 15):
                </label>
                <Input
                  id="max"
                  type="number"
                  min={1}
                  max={50}
                  value={maxResults}
                  onChange={(e) => setMaxResults(Math.max(1, Math.min(50, Number(e.target.value))))}
                  className="w-24"
                />
                <Button onClick={onFetchEmails} disabled={!isAuthed || loadingFetch}>
                  {loadingFetch ? "Fetching…" : "Fetch Last X Emails"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={onClassify}
                  disabled={loadingClassify || emails.length === 0}
                >
                  {loadingClassify ? "Classifying…" : "Classify Emails"}
                </Button>
              </div>

              {/* Category Filters */}
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

        {/* Email List Section */}
        <section className="mt-8">
          {filteredEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {emails.length === 0
                ? "No emails yet. Log in with Google and fetch your emails."
                : "No emails in this category."}
            </p>
          ) : (
            <div className="grid gap-4">
              {filteredEmails.map((e) => {
                const cat = classifications[e.id];
                
                return (
                  <Card key={e.id}>
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle className="text-pretty text-base">
                        {e.subject || "(No Subject)"}
                      </CardTitle>
                      <span
                        className={cn(
                          "rounded-md px-2 py-1 text-xs font-medium",
                          cat 
                            ? "bg-secondary text-secondary-foreground" 
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {cat || "Unclassified"}
                      </span>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">From:</span> {e.from || "Unknown"} •{" "}
                        <span className="font-medium">Date:</span>{" "}
                        {e.date ? new Date(e.date).toLocaleString() : "Unknown"}
                      </div>
                      {e.snippet && <p className="text-sm">{e.snippet}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FilterPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active 
          ? "bg-primary text-primary-foreground" 
          : "bg-card hover:bg-accent"
      )}
      // aria-pressed={active}
    >
      {label}
      {typeof count === "number" ? (
        <span className="ml-2 opacity-80">({count})</span>
      ) : null}
    </button>
  );
}
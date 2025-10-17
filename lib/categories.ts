export const AllowedCategories = [
  "Important",
  "Promotions",
  "Social",
  "Marketing",
  "Spam",
  "General",
] as const;

export type Category = (typeof AllowedCategories)[number];

export function normalizeCategory(input: string): Category {
  const t = (input || "").trim().toLowerCase();
  if (t.startsWith("important")) return "Important";
  if (t.startsWith("promotion")) return "Promotions";
  if (t.startsWith("social")) return "Social";
  if (t.startsWith("marketing")) return "Marketing";
  if (t.startsWith("spam")) return "Spam";
  return "General";
}

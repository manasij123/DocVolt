/* Keyword → color heuristic.
 *
 * Used when an admin generates an AI category icon — if they haven't manually
 * chosen a color, we scan the description text and pick a thematic color so
 * the hero card / pills get a sensible auto-tint.
 *
 * The mapping is intentionally simple (regex-by-keyword) because we don't want
 * to spend tokens on another LLM call for something this small.
 */

export const COLOR_THEME: Array<[RegExp, string, string]> = [
  // [regex, hex, label]
  [/\b(monthly|month|calendar|date|schedule|recurring|periodic)\b/i,         "#3B82F6", "monthly"],
  [/\b(report|ifa|analysis|analytics|chart|graph|dashboard|summary)\b/i,     "#8B5CF6", "report"],
  [/\b(letter|forward(ing)?|memo|notice|announce(ment)?|circular)\b/i,        "#10B981", "letter"],
  [/\b(tax|gst|invoice|bill|money|finance|bank|payment|salary|ledger)\b/i,    "#059669", "finance"],
  [/\b(legal|contract|agreement|deed|law|compliance|policy|terms)\b/i,        "#475569", "legal"],
  [/\b(warning|alert|urgent|error|risk|critical|danger)\b/i,                 "#EF4444", "alert"],
  [/\b(personal|id|kyc|aadhaar|aadhar|pan|passport|profile)\b/i,             "#F59E0B", "personal"],
  [/\b(health|medical|hospital|doctor|prescription|insurance)\b/i,            "#06B6D4", "health"],
  [/\b(education|school|exam|result|certificate|diploma|study)\b/i,           "#0EA5E9", "education"],
  [/\b(travel|ticket|booking|hotel|flight|trip|visa)\b/i,                     "#0891B2", "travel"],
  [/\b(image|photo|gallery|picture|media)\b/i,                               "#EC4899", "media"],
  [/\b(receipt|expense|purchase|order|payment slip)\b/i,                      "#84CC16", "receipt"],
  [/\b(client|customer|account|profile)\b/i,                                  "#6366F1", "client"],
  [/\b(meeting|note|minute|agenda|protocol)\b/i,                              "#A855F7", "meeting"],
  [/\b(important|priority|star|favourite|favorite|key)\b/i,                   "#FBBF24", "priority"],
  [/\b(archive|old|backup|history|past)\b/i,                                  "#64748B", "archive"],
  [/\b(green|nature|plant|leaf|eco|environment)\b/i,                          "#22C55E", "nature"],
  [/\b(red|fire|hot|warning|stop)\b/i,                                        "#DC2626", "red"],
  [/\b(blue|sky|water|sea|ocean)\b/i,                                         "#2563EB", "blue"],
  [/\b(purple|royal|premium|magic)\b/i,                                       "#9333EA", "purple"],
  [/\b(orange|sunset|warm)\b/i,                                              "#EA580C", "orange"],
  [/\b(pink|love|romantic)\b/i,                                              "#DB2777", "pink"],
];

/** Returns the suggested hex (with leading #) or null if no keyword matched. */
export function suggestColorFromText(text: string): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;
  for (const [re, hex] of COLOR_THEME) {
    if (re.test(t)) return hex;
  }
  // Fallback: hash the text to one of the theme colors deterministically so
  // a category called "X" always gets the same colour even if no keyword hit.
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  const palette = COLOR_THEME.map(([, hex]) => hex);
  return palette[h % palette.length] || null;
}

/* Mirror of /app/website/src/colorTheme.ts so mobile uses the same heuristic. */
export const COLOR_THEME: Array<[RegExp, string]> = [
  [/\b(monthly|month|calendar|date|schedule|recurring|periodic)\b/i,         "#3B82F6"],
  [/\b(report|ifa|analysis|analytics|chart|graph|dashboard|summary)\b/i,     "#8B5CF6"],
  [/\b(letter|forward(ing)?|memo|notice|announce(ment)?|circular)\b/i,        "#10B981"],
  [/\b(tax|gst|invoice|bill|money|finance|bank|payment|salary|ledger)\b/i,    "#059669"],
  [/\b(legal|contract|agreement|deed|law|compliance|policy|terms)\b/i,        "#475569"],
  [/\b(warning|alert|urgent|error|risk|critical|danger)\b/i,                 "#EF4444"],
  [/\b(personal|id|kyc|aadhaar|aadhar|pan|passport|profile)\b/i,             "#F59E0B"],
  [/\b(health|medical|hospital|doctor|prescription|insurance)\b/i,            "#06B6D4"],
  [/\b(education|school|exam|result|certificate|diploma|study)\b/i,           "#0EA5E9"],
  [/\b(travel|ticket|booking|hotel|flight|trip|visa)\b/i,                     "#0891B2"],
  [/\b(image|photo|gallery|picture|media)\b/i,                               "#EC4899"],
  [/\b(receipt|expense|purchase|order|payment slip)\b/i,                      "#84CC16"],
  [/\b(client|customer|account|profile)\b/i,                                  "#6366F1"],
  [/\b(meeting|note|minute|agenda|protocol)\b/i,                              "#A855F7"],
  [/\b(important|priority|star|favourite|favorite|key)\b/i,                   "#FBBF24"],
  [/\b(archive|old|backup|history|past)\b/i,                                  "#64748B"],
  [/\b(green|nature|plant|leaf|eco|environment)\b/i,                          "#22C55E"],
  [/\b(red|fire|hot|warning|stop)\b/i,                                        "#DC2626"],
  [/\b(blue|sky|water|sea|ocean)\b/i,                                         "#2563EB"],
  [/\b(purple|royal|premium|magic)\b/i,                                       "#9333EA"],
  [/\b(orange|sunset|warm)\b/i,                                              "#EA580C"],
  [/\b(pink|love|romantic)\b/i,                                              "#DB2777"],
];

export function suggestColorFromText(text: string): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;
  for (const [re, hex] of COLOR_THEME) {
    if (re.test(t)) return hex;
  }
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  const palette = COLOR_THEME.map(([, hex]) => hex);
  return palette[h % palette.length] || null;
}

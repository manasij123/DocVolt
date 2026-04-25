// West Bengal Government Education App — Strategic Design System
// Primary identity: Royal Blue #1A73E8 + White (per State Portal Standard)
// Module accents: Blue (Monthly Return), Orange (MDM/Forwarding), Green (IFA), Teal (Others)

export const colors = {
  // Surfaces
  background: "#F2F2F2",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  surfaceContainer: "#FAFBFC",

  // Brand — WBBPE / Egiye Bangla
  primary: "#1A73E8",          // Royal Blue (state portal standard)
  primaryDark: "#0D47A1",       // Hover / active
  primarySoft: "#E8F0FE",       // Tinted background
  primaryNavy: "#202124",       // Institutional Black

  // Accent (legacy aliases used across the app)
  accent: "#1A73E8",
  accentSoft: "#4285F4",
  accentEnd: "#0D47A1",
  accentHover: "#0D47A1",

  // Text
  textPrimary: "#202124",       // Institutional Black
  textSecondary: "#5F6368",     // Google secondary grey
  textMuted: "#80868B",
  textOnPrimary: "#FFFFFF",

  // Lines
  border: "#DADCE0",
  borderStrong: "#BDC1C6",

  // Inputs
  inputBg: "#F8F9FA",

  // Status — semantic
  success: "#1B5E20",           // Forest Green (Health/MDM submitted)
  successSoft: "#E6F4EA",
  warning: "#FF9800",           // Safety Orange (PM Poshan/MDM)
  warningSoft: "#FEF7E0",
  danger: "#B00020",            // Material Red error standard
  dangerSoft: "#FCE8E6",
  info: "#1A73E8",

  // Misc
  iconBlueBg: "#E8F0FE",
  overlay: "rgba(32,33,36,0.55)",
  white: "#FFFFFF",
};

export const gradients = {
  primary: ["#1A73E8", "#0D47A1"] as const,        // Royal Blue → Deep Blue
  primarySoft: ["#4285F4", "#1A73E8"] as const,
  hero: ["#0D47A1", "#1A73E8", "#1565C0"] as const, // Authority hero
  heroOverlay: ["rgba(13,71,161,0.30)", "rgba(13,71,161,0.95)"] as const,
  accent: ["#1A73E8", "#0D47A1"] as const,
  card: ["#FFFFFF", "#F8FAFC"] as const,

  // Module identities (per research doc)
  iconBlue: ["#1A73E8", "#0D47A1"] as const,        // Monthly Return — Trust/Finance
  iconOrange: ["#FFA726", "#F57C00"] as const,      // Forwarding Letter / MDM — PM Poshan warmth
  iconGreen: ["#43A047", "#1B5E20"] as const,       // IFA Report — Health/Wellness
  iconTeal: ["#26A69A", "#00695C"] as const,        // Others — Calm secondary
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const shadow = {
  sm: {
    shadowColor: "#202124",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#202124",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  lg: {
    shadowColor: "#202124",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  glow: {
    shadowColor: "#1A73E8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 18,
    elevation: 8,
  },
};

// Module → gradient mapping (Monthly Return blue, MDM orange, IFA green, Others teal)
export const categoryGradients: Record<string, readonly [string, string]> = {
  MONTHLY_RETURN: ["#1A73E8", "#0D47A1"] as const,
  FORWARDING_LETTER: ["#FFA726", "#F57C00"] as const,
  IFA_REPORT: ["#43A047", "#1B5E20"] as const,
  OTHERS: ["#26A69A", "#00695C"] as const,
};

export const categorySoft: Record<string, string> = {
  MONTHLY_RETURN: "#E8F0FE",
  FORWARDING_LETTER: "#FEF3E2",
  IFA_REPORT: "#E6F4EA",
  OTHERS: "#E0F2F1",
};

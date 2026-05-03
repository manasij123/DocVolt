// DocVault — Strategic Design System
// Primary identity: #3801FF (Deep Purple) + White
// Module accents retained for category differentiation.

export const colors = {
  // Surfaces
  background: "#F7F8FC",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  surfaceContainer: "#FAFBFC",

  // Brand — DocVault
  primary: "#3801FF",           // Deep Purple — primary CTA & accent
  primaryDark: "#2900BF",        // Hover / active
  primarySoft: "#EEE8FF",        // Tinted background
  primaryNavy: "#202124",        // Institutional Black

  // Accent (legacy aliases used across the app — now all map to #3801FF)
  accent: "#3801FF",
  accentSoft: "#5B2EFF",
  accentEnd: "#2900BF",
  accentHover: "#2900BF",

  // Text
  textPrimary: "#0F172A",        // Slate 900
  textSecondary: "#475569",      // Slate 600
  textMuted: "#94A3B8",
  textOnPrimary: "#FFFFFF",
  text: "#0F172A",               // Legacy alias

  // Lines
  border: "#EDEEF2",
  borderStrong: "#CBD5E1",

  // Inputs
  inputBg: "#F8FAFC",

  // Status — semantic
  success: "#10B981",
  successSoft: "#D1FAE5",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  info: "#3801FF",

  // Misc
  iconBlueBg: "#EEE8FF",
  overlay: "rgba(15,23,42,0.55)",
  white: "#FFFFFF",
};

export const gradients = {
  primary: ["#5B2EFF", "#3801FF"] as const,        // Lighter Purple → Deep Purple
  primarySoft: ["#7C3AED", "#3801FF"] as const,
  hero: ["#7C3AED", "#5B2EFF", "#3801FF"] as const,
  heroOverlay: ["rgba(41,0,191,0.30)", "rgba(41,0,191,0.95)"] as const,
  accent: ["#5B2EFF", "#3801FF"] as const,
  card: ["#FFFFFF", "#F8FAFC"] as const,

  // Module identities
  iconBlue: ["#3801FF", "#2900BF"] as const,
  iconOrange: ["#FFA726", "#F57C00"] as const,
  iconGreen: ["#10B981", "#059669"] as const,
  iconTeal: ["#06B6D4", "#0891B2"] as const,
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
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  lg: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  glow: {
    shadowColor: "#3801FF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 18,
    elevation: 8,
  },
};

// Module → gradient mapping
export const categoryGradients: Record<string, readonly [string, string]> = {
  MONTHLY_RETURN: ["#3801FF", "#2900BF"] as const,
  FORWARDING_LETTER: ["#FFA726", "#F57C00"] as const,
  IFA_REPORT: ["#10B981", "#059669"] as const,
  OTHERS: ["#06B6D4", "#0891B2"] as const,
};

export const categorySoft: Record<string, string> = {
  MONTHLY_RETURN: "#EEE8FF",
  FORWARDING_LETTER: "#FEF3E2",
  IFA_REPORT: "#D1FAE5",
  OTHERS: "#CFFAFE",
};

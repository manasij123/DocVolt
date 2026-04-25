export const colors = {
  background: "#F4F6FB",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  primary: "#0B1220",
  primaryActive: "#111A2E",
  accent: "#2563EB",
  accentSoft: "#3B82F6",
  accentEnd: "#8B5CF6",
  accentHover: "#1D4ED8",
  textPrimary: "#0B1220",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  success: "#10B981",
  successSoft: "#D1FAE5",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  overlay: "rgba(11,18,32,0.55)",
  inputBg: "#F8FAFC",
  iconBlueBg: "#EFF6FF",
  white: "#FFFFFF",
};

export const gradients = {
  primary: ["#3B82F6", "#8B5CF6"] as const,
  primarySoft: ["#60A5FA", "#A78BFA"] as const,
  hero: ["#0B1220", "#1E293B", "#312E81"] as const,
  heroOverlay: ["rgba(11,18,32,0.40)", "rgba(11,18,32,0.92)"] as const,
  accent: ["#2563EB", "#7C3AED"] as const,
  card: ["#FFFFFF", "#F8FAFC"] as const,
  iconBlue: ["#3B82F6", "#1D4ED8"] as const,
  iconViolet: ["#8B5CF6", "#6D28D9"] as const,
  iconAmber: ["#F59E0B", "#D97706"] as const,
  iconEmerald: ["#10B981", "#047857"] as const,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const shadow = {
  sm: {
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },
  lg: {
    shadowColor: "#1E293B",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 36,
    elevation: 12,
  },
  glow: {
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const categoryGradients: Record<string, readonly [string, string]> = {
  MONTHLY_RETURN: ["#3B82F6", "#1D4ED8"] as const,
  FORWARDING_LETTER: ["#8B5CF6", "#6D28D9"] as const,
  IFA_REPORT: ["#10B981", "#047857"] as const,
  OTHERS: ["#F59E0B", "#D97706"] as const,
};

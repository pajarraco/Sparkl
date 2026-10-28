// Theme tokens for apps/frontend.
// Source of truth: context/design.md Palette + Typography + Spacing.
// Values verified against apps/frontend/prototype/board.html :root
// (variant B winner) so the real app starts from the approved look.

export const THEME_COLORS = {
  paper: "#FFFFFF",
  paper2: "#F8FAFC",
  ink: "#1E293B",
  inkSoft: "#64748B",
  inkMute: "#94A3B8",
  indigo: "#2205A4",
  indigoDeep: "#1A0480",
  orange: "#FF6B00",
  orangeDeep: "#C24E00",
  orangeTint: "#FFF0E6",
  stone: "#E2E8F0",
  success: "#16A34A",
  successTint: "#DCFCE7",
  successText: "#15803D",
  danger: "#B91C1C",
  dangerTint: "#FEE2E2",
} as const;

export type ThemeColorName = keyof typeof THEME_COLORS;

export const THEME_RADII = {
  control: 6,
  cardMin: 6,
  cardMax: 14,
  sheet: 14,
  avatar: 999,
} as const;

export const THEME_SPACING = {
  edge: 16,
  edgeWide: 20,
  extraEdge: 32,
  section: 24,
  rowMin: 8,
  rowMax: 12,
  touchTarget: 48,
} as const;

export const THEME_FONT = {
  family: "Elms Sans",
  fallback: '-apple-system, "Segoe UI", system-ui, sans-serif' as const,
} as const;

// Native font families (expo-font static cuts from
// @expo-google-fonts/elms-sans, loaded in app/_layout.tsx). React Native
// cannot synthesize weights from one custom family, so every StyleSheet
// uses the cut matching its former fontWeight and sets NO fontWeight —
// Android would otherwise faux-bolden an already-bold cut. Keys mirror
// the package export names so a rename breaks loudly at the import.
// Web resolves the same names through expo-font's injected @font-face;
// global.css --font-sans carries the Regular cut for plain body text.
export const THEME_FONT_FAMILY = {
  regular: "ElmsSans_400Regular",
  medium: "ElmsSans_500Medium",
  semiBold: "ElmsSans_600SemiBold",
  bold: "ElmsSans_700Bold",
} as const;

export type ThemeFontFamilyName =
  (typeof THEME_FONT_FAMILY)[keyof typeof THEME_FONT_FAMILY];

// Status pill mapping per design.md. Uses only tokens above — no new
// colours introduced (rules.md). Claimed / in-progress reuse paper2 as
// the tint so no indigo-tint token is needed.
export const STATUS_PILL = {
  open: { background: "#DCFCE7", text: "#15803D" },
  claimed: { background: "#F8FAFC", text: "#1A0480" },
  inProgress: { background: "#F8FAFC", text: "#1A0480" },
  completed: { background: "#F8FAFC", text: "#64748B" },
  cancelled: { background: "#FEE2E2", text: "#B91C1C" },
} as const;

export type JobStatusPill = keyof typeof STATUS_PILL;

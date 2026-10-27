import { describe, expect, it } from "vitest";
import { STATUS_PILL, THEME_COLORS, THEME_RADII, THEME_SPACING } from "./theme";

describe("theme tokens", () => {
  it("matches the design.md palette and prototype :root", () => {
    expect(THEME_COLORS).toMatchObject({
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
    });
  });

  it("keeps orange text off pure orange (AA rule)", () => {
    expect(THEME_COLORS.orange).not.toBe(THEME_COLORS.orangeDeep);
  });

  it("stays within the radius scale (avatars excepted)", () => {
    expect(THEME_RADII.control).toBe(6);
    expect(THEME_RADII.sheet).toBe(14);
    expect(THEME_RADII.cardMax).toBeLessThanOrEqual(14);
  });

  it("maps every job status to a pill without new colours", () => {
    const known = new Set(Object.values(THEME_COLORS));
    for (const pill of Object.values(STATUS_PILL)) {
      expect(known.has(pill.background)).toBe(true);
      expect(known.has(pill.text)).toBe(true);
    }
    expect(Object.keys(STATUS_PILL).sort()).toEqual([
      "cancelled",
      "claimed",
      "completed",
      "inProgress",
      "open",
    ]);
  });

  it("keeps touch targets at 44pt", () => {
    expect(THEME_SPACING.touchTarget).toBe(44);
  });
});

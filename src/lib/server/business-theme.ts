/**
 * Business public-page theme configuration.
 *
 * Each business can optionally define a color theme stored as JSONB in
 * `businesses.theme_config`. When present, these CSS custom properties
 * are applied to the business page, overriding Kivo defaults.
 *
 * Null/missing theme = Kivo default teal palette.
 */

export interface BusinessTheme {
  /** Primary brand color (buttons, CTAs). */
  primary: string;
  /** Accent color (badges, highlights). */
  accent: string;
  /** Page/section background. */
  background: string;
  /** Card/surface background. */
  surface: string;
  /** Primary text color. */
  foreground: string;
  /** Secondary/muted text color. */
  muted: string;
}

/** Default Kivo theme when no business theme is configured. */
export const DEFAULT_THEME: BusinessTheme = {
  primary: "#13847D",
  accent: "#A67C00",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  foreground: "#0F172A",
  muted: "#475569",
};

/**
 * Parse a raw JSONB value into a BusinessTheme, falling back to defaults
 * for any missing/invalid fields.
 */
export function parseTheme(input: unknown): BusinessTheme {
  if (!input || typeof input !== "object") return { ...DEFAULT_THEME };
  const obj = input as Record<string, unknown>;
  return {
    primary: typeof obj.primary === "string" ? obj.primary : DEFAULT_THEME.primary,
    accent: typeof obj.accent === "string" ? obj.accent : DEFAULT_THEME.accent,
    background: typeof obj.background === "string" ? obj.background : DEFAULT_THEME.background,
    surface: typeof obj.surface === "string" ? obj.surface : DEFAULT_THEME.surface,
    foreground: typeof obj.foreground === "string" ? obj.foreground : DEFAULT_THEME.foreground,
    muted: typeof obj.muted === "string" ? obj.muted : DEFAULT_THEME.muted,
  };
}

/**
 * Convert a BusinessTheme to CSS custom properties for inline style.
 */
export function themeToCssVars(theme: BusinessTheme): Record<string, string> {
  return {
    "--business-primary": theme.primary,
    "--business-accent": theme.accent,
    "--business-bg": theme.background,
    "--business-surface": theme.surface,
    "--business-fg": theme.foreground,
    "--business-muted": theme.muted,
  };
}

// utils/theme.js — "Midnight Intimacy" Design System
// Dark theme only · Plum, wine, and cream · Handcrafted warmth
// Deep plum backgrounds · Serif headlines · Glass cards · Wine accent · Breathing room

import { Platform } from "react-native";

// ═══════════════════════════════════════════════════════
// UTILITY — Safe alpha overlay for hex and rgba colors
// ═══════════════════════════════════════════════════════

/**
 * Applies an alpha value to any color string (hex or rgba).
 * @param {string} color  – "#C4567A", "#C4567AFF", "rgba(196,86,122,0.5)", etc.
 * @param {number} alpha  – 0–1 opacity
 * @returns {string} rgba(…) color string
 */
export function withAlpha(color, alpha) {
  if (!color || typeof color !== "string") return `rgba(0,0,0,${alpha})`;

  // Handle rgba/rgb input
  const rgbaMatch = color.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)$/
  );
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`;
  }

  // Handle hex input (3, 4, 6, or 8 digits)
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length === 4) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]; // drop alpha nibble
  if (hex.length === 8) hex = hex.slice(0, 6); // drop existing alpha byte
  const r = parseInt(hex.slice(0, 2), 16) || 0;
  const g = parseInt(hex.slice(2, 4), 16) || 0;
  const b = parseInt(hex.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════════════════════
// SEMANTIC TOKEN PALETTES — Velvet Glass
// ═══════════════════════════════════════════════════════

export const DARK_PALETTE = {
  // Ink-black background — Midnight Intimacy palette
  background: "#070509",       // inkBlack
  surface: "#131016",          // charcoalPlum — cards, inputs
  surface2: "#1C1520",         // surfacePlum — secondary surfaces
  surfaceElevated: "#241C28", // tertiary surfaces, modal overlays
  surfaceGlass: "rgba(28,21,32,0.55)", // plum-tinted frosted glass

  // Soft cream text with intentional hierarchy
  text: "#F2E9E6",             // softCream
  textSecondary: "rgba(242,233,230,0.78)", // creamSubtle-level
  textMuted: "rgba(242,233,230,0.58)",     // readable muted text (WCAG AA)
  textGlow: "rgba(154,46,94,0.9)",         // mulberry glow text

  // Subtle glass borders — white at very low opacity
  border: "rgba(255,255,255,0.06)",
  borderGlass: "rgba(255,255,255,0.08)",   // glass card borders
  divider: "rgba(255,255,255,0.04)",

  // Sexy red accent — deep, vibrant red
  primary: "#C3113D",          // sexy red — primary CTAs, active states
  primaryMuted: "#DF2{A}4B",     // muted ruby — secondary accent
  primaryGlow: "rgba(195,17,61,0.35)",     // sexy red glow halo
  accent: "#A89060",           // matteGold — PREMIUM ONLY
  accentMuted: "rgba(168,144,96,0.4)",

  // Semantic
  danger: "#B85454",
  success: "#5A8B60",
  shadow: "#070509",
  overlay: "rgba(7,5,9,0.8)",
};

// Brand guardrails: "Dark theme only" — no light palette
export const LIGHT_PALETTE = DARK_PALETTE;

// Legacy: COLORS = dark palette for backward compatibility
export const COLORS = {
  ...DARK_PALETTE,
  inkBlack: DARK_PALETTE.background,
  charcoalPlum: DARK_PALETTE.surface,
  surfacePlum: DARK_PALETTE.surface2,
  softCream: DARK_PALETTE.text,
  creamSubtle: DARK_PALETTE.textSecondary,
  textPrimary: DARK_PALETTE.text,
  textSecondary: DARK_PALETTE.textSecondary,
  textTertiary: DARK_PALETTE.textMuted,
  card: DARK_PALETTE.surface,
  cardBorder: DARK_PALETTE.border,
  wine: DARK_PALETTE.primary,
  mulberry: DARK_PALETTE.primaryMuted,
  wineMuted: "#5E1940",
  wineDeep: "#4C1030",
  error: DARK_PALETTE.danger,
  warmCharcoal: DARK_PALETTE.background,
  obsidian: DARK_PALETTE.background,
  charcoal: DARK_PALETTE.surface,
  deepPlum: "#1A0D18",
  pureWhite: DARK_PALETTE.text,
  cream: DARK_PALETTE.text,
  softGray: DARK_PALETTE.textMuted,
  champagneGold: DARK_PALETTE.accent,
  roseCopper: DARK_PALETTE.primary,
  classicGold: DARK_PALETTE.accent,
  mutedGold: DARK_PALETTE.accentMuted,
  blushRose: DARK_PALETTE.primaryMuted,
  highlight: DARK_PALETTE.accent,
  plumVignette: "#1A0D18",
  blushRoseLight: DARK_PALETTE.primaryMuted,
  deepRed: DARK_PALETTE.primary,
  beetroot: "#5E1940",
  roseGold: DARK_PALETTE.primaryMuted,
  platinum: "rgba(242,233,230,0.9)",
};

// ═══════════════════════════════════════════════════════
// GRADIENTS — Deep, moody, magnetic
// ═══════════════════════════════════════════════════════

export const getGradients = (palette) => {
  const p = palette || DARK_PALETTE;
  return {
    // Screen background: deep vertical wash
    screenBackground: [p.background, "#0A0611", p.background],
    // Glass card fill — plum-tinted
    glass: ["rgba(28,21,32,0.55)", "rgba(19,16,22,0.70)"],
    glassSubtle: ["rgba(28,21,32,0.35)", "rgba(19,16,22,0.45)"],
    // Accent glow bloom (for behind cards)
    accentBloom: [p.primaryGlow, "transparent"],
    // CTA button
    cta: [p.primary, p.primaryMuted],
    ctaGlow: [p.primaryGlow, "transparent"],
    // Legacy compat
    wineCTA: [p.primary, p.primaryMuted],
    plumVignette: ["#1A0D18", p.background],
    background: [p.background, p.background],
    surface: ["rgba(28,21,32,0.60)", "rgba(19,16,22,0.50)"],
    primary: [p.primary, p.primaryMuted],
    secondary: [p.surface2, p.primary],
    gold: [p.accent, "#8B7340"],
    champagne: [p.text, p.text + "CC"],
  };
};

export const GRADIENTS = getGradients(DARK_PALETTE);

// ═══════════════════════════════════════════════════════
// TYPOGRAPHY — Velvet Editorial
// Large serif headlines, intentional hierarchy, huge breathing room
// ═══════════════════════════════════════════════════════

export const SERIF = Platform.select({
  ios: "DMSerifDisplay-Regular",
  android: "DMSerifDisplay_400Regular",
  default: "System",
});

export const SERIF_ACCENT = SERIF; // Brand: only DM Serif Display allowed for serif

export const SANS = Platform.select({
  ios: "Lato-Regular",
  android: "Lato_400Regular",
  default: "System",
});

export const SANS_MEDIUM = Platform.select({
  ios: "Lato-Regular",
  android: "Lato_400Regular",
  default: "System",
});

export const SANS_BOLD = Platform.select({
  ios: "Lato-Bold",
  android: "Lato_700Bold",
  default: "System",
});

const typographyBase = {
  // Hero display
  display: {
    fontFamily: SERIF,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.5,
    fontWeight: "400",
  },
  // Page title
  h1: {
    fontFamily: SERIF,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.3,
    fontWeight: "400",
  },
  // Section header
  h2: {
    fontFamily: SERIF,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.2,
    fontWeight: "400",
  },
  // Card title / subsection
  h3: {
    fontFamily: SANS_BOLD,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    fontWeight: "600",
  },
  // Body text
  body: {
    fontFamily: SANS,
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  bodySecondary: {
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  // Small text
  caption: {
    fontFamily: SANS,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  // Eyebrow / overline
  label: {
    fontFamily: SANS_BOLD,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  // CTA button
  button: {
    fontFamily: SANS_BOLD,
    fontSize: 16,
    letterSpacing: 0.5,
    fontWeight: "600",
  },
};

export const TYPOGRAPHY = {
  ...typographyBase,
  body: { ...typographyBase.body, color: COLORS.textPrimary },
  bodySecondary: { ...typographyBase.bodySecondary, color: COLORS.textSecondary },
  caption: { ...typographyBase.caption, color: COLORS.textTertiary },
  label: { ...typographyBase.label, color: COLORS.textSecondary },
};

// ═══════════════════════════════════════════════════════
// SPACING — Velvet breathing room (generous)
// ═══════════════════════════════════════════════════════

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 48,
  screen: 24,    // horizontal screen padding
  section: 28,   // between content sections
  gutter: 16,    // between cards in a row
};

// ═══════════════════════════════════════════════════════
// BORDER RADIUS — Glass card aesthetic
// ═══════════════════════════════════════════════════════

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
};

// ═══════════════════════════════════════════════════════
// GLASS CARD — Reusable glass morphism styles
// ═══════════════════════════════════════════════════════

export const getGlassStyle = (palette) => {
  return {
    backgroundColor: "rgba(28,21,32,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: BORDER_RADIUS.xl,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#070509",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        }
      : { elevation: 4 }),
  };
};

// ═══════════════════════════════════════════════════════
// SHADOWS — Deep, cinematic
// ═══════════════════════════════════════════════════════

export const getShadows = (palette) => {
  const shadowColor = palette?.shadow ?? "#070509";
  return {
    small: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      default: {},
    }),
    medium: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
    large: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
      default: {},
    }),
    glow: Platform.select({
      ios: {
        shadowColor: palette?.primary || "#C3113D",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      default: {},
    }),
  };
};

export const SHADOWS = getShadows(DARK_PALETTE);

// ═══════════════════════════════════════════════════════
// ICON SIZES
// ═══════════════════════════════════════════════════════

export const ICON_SIZES = {
  sm: 18,
  md: 22,
  lg: 26,
};

// ═══════════════════════════════════════════════════════
// ANIMATION — Slow, intentional, cinematic
// ═══════════════════════════════════════════════════════

export const ANIMATION = { fast: 220, normal: 450, slow: 700, glacial: 1000 };
export const Z_INDEX = { base: 0, card: 5, overlay: 10, modal: 1000 };

// ═══════════════════════════════════════════════════════
// NAVIGATION THEME HELPERS
// ═══════════════════════════════════════════════════════

export const getNavigationTheme = (palette) => {
  const p = palette || DARK_PALETTE;
  return {
    dark: true,
    colors: {
      primary: p.primary,
      background: p.background,
      card: p.surface,
      text: p.text,
      border: p.border,
      notification: p.primary,
    },
    fonts: {
      regular: {
        fontFamily: TYPOGRAPHY?.body?.fontFamily || 'System',
        fontWeight: (TYPOGRAPHY?.body?.fontWeight && String(TYPOGRAPHY.body.fontWeight)) || '400',
      },
      medium: {
        fontFamily: SANS_MEDIUM || 'System',
        fontWeight: '500',
      },
      bold: {
        fontFamily: TYPOGRAPHY?.h3?.fontFamily || TYPOGRAPHY?.body?.fontFamily || 'System',
        fontWeight: '700',
      },
      heavy: {
        fontFamily: SERIF || 'System',
        fontWeight: '700',
      },
    },
  };
};

export default {
  COLORS,
  DARK_PALETTE,
  LIGHT_PALETTE,
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  GRADIENTS,
  ANIMATION,
  Z_INDEX,
  SERIF,
  SERIF_ACCENT,
  SANS,
  SANS_MEDIUM,
  SANS_BOLD,
  withAlpha,
  getGlassStyle,
  getGradients,
  getShadows,
  getNavigationTheme,
};

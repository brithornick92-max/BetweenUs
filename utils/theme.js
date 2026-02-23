// utils/theme.js — "Velvet Glass" Design System
// Hybrid: Velvet Minimal (luxury, slow, intentional) × Magnetic Glass (premium, alive, polished)
// Deep plum backgrounds · Large serif headlines · Glass cards · Single glowing accent · Huge breathing room

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
  // Deep velvet plum backgrounds — richer than pure black
  background: "#0B0710",       // deep plum-black
  surface: "#140F1C",          // glass card base
  surface2: "#1D1528",         // elevated glass surface
  surfaceGlass: "rgba(24,18,36,0.65)", // frosted glass overlay

  // Warm cream text with intentional hierarchy
  text: "#F5EDE8",             // warm cream white
  textSecondary: "rgba(245,237,232,0.78)", // secondary text
  textMuted: "rgba(245,237,232,0.42)",     // whisper-level text
  textGlow: "rgba(200,160,180,0.9)",       // accent glow text

  // Subtle glass borders
  border: "rgba(255,255,255,0.07)",
  borderGlass: "rgba(255,255,255,0.12)",   // glass card borders
  divider: "rgba(255,255,255,0.05)",

  // Single glowing accent — warm rose-wine
  primary: "#C4567A",          // glowing rose accent
  primaryMuted: "#8B3456",     // deeper muted rose
  primaryGlow: "rgba(196,86,122,0.35)",    // glow halo
  accent: "#D4A574",           // warm champagne gold accent
  accentMuted: "rgba(212,165,116,0.4)",

  // Semantic
  danger: "#B85454",
  success: "#5A8B60",
  shadow: "#060410",
  overlay: "rgba(8,4,14,0.8)",
};

export const LIGHT_PALETTE = {
  background: "#FAF7F5",       // warm linen white
  surface: "#FFFFFF",
  surface2: "#F3EDE8",
  surfaceGlass: "rgba(255,255,255,0.72)",

  text: "#1A1118",
  textSecondary: "rgba(26,17,24,0.72)",
  textMuted: "rgba(26,17,24,0.45)",
  textGlow: "#9A3D5C",

  border: "rgba(26,17,24,0.08)",
  borderGlass: "rgba(26,17,24,0.14)",
  divider: "rgba(26,17,24,0.06)",

  primary: "#B04466",
  primaryMuted: "#8B3456",
  primaryGlow: "rgba(176,68,102,0.18)",
  accent: "#C4946A",
  accentMuted: "rgba(196,148,106,0.3)",

  danger: "#C25A6A",
  success: "#5A8B60",
  shadow: "#1A1118",
  overlay: "rgba(0,0,0,0.35)",
};

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
  wine: DARK_PALETTE.primaryMuted,
  mulberry: DARK_PALETTE.primary,
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
  blushRose: DARK_PALETTE.primary,
  highlight: DARK_PALETTE.accent,
  plumVignette: "#1A0D18",
  blushRoseLight: "#D4708B",
  deepRed: DARK_PALETTE.primaryMuted,
  beetroot: "#5E1940",
  roseGold: DARK_PALETTE.primary,
  platinum: "rgba(245,237,232,0.9)",
};

// ═══════════════════════════════════════════════════════
// GRADIENTS — Deep, moody, magnetic
// ═══════════════════════════════════════════════════════

export const getGradients = (palette) => {
  const p = palette || DARK_PALETTE;
  const isDark = p.background === DARK_PALETTE.background;
  if (isDark) {
    return {
      // Screen background: deep vertical wash
      screenBackground: [p.background, "#0F0A18", p.background],
      // Glass card fill
      glass: ["rgba(30,22,44,0.55)", "rgba(20,14,32,0.70)"],
      glassSubtle: ["rgba(30,22,44,0.35)", "rgba(20,14,32,0.45)"],
      // Accent glow bloom (for behind cards)
      accentBloom: [p.primaryGlow, "transparent"],
      // CTA button
      cta: [p.primary, p.primaryMuted],
      ctaGlow: [p.primaryGlow, "transparent"],
      // Legacy compat
      wineCTA: [p.primaryMuted, p.primary],
      plumVignette: ["#1A0D18", p.background],
      background: [p.background, p.background],
      surface: ["rgba(30,22,44,0.60)", "rgba(20,14,32,0.50)"],
      primary: [p.primary, p.primaryMuted],
      secondary: [p.surface2, p.primaryMuted],
      gold: [p.accent, "#B8860B"],
      champagne: [p.text, p.text + "CC"],
    };
  }
  return {
    screenBackground: [p.background, p.surface2, p.background],
    glass: ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.65)"],
    glassSubtle: ["rgba(255,255,255,0.60)", "rgba(255,255,255,0.45)"],
    accentBloom: [p.primaryGlow, "transparent"],
    cta: [p.primary, p.primaryMuted],
    ctaGlow: [p.primaryGlow, "transparent"],
    wineCTA: [p.primaryMuted, p.primary],
    plumVignette: [p.surface2, p.background],
    background: [p.background, p.background],
    surface: [p.surface, p.surface2],
    primary: [p.primary, p.primaryMuted],
    secondary: [p.surface2, p.primaryMuted],
    gold: [p.accent, "#B8860B"],
    champagne: [p.text, p.text + "99"],
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

export const SERIF_ACCENT = Platform.select({
  ios: "Playfair Display",
  android: "PlayfairDisplay_300Light",
  default: "System",
});

export const SANS = Platform.select({
  ios: "Inter",
  android: "Inter_400Regular",
  default: "System",
});

export const SANS_MEDIUM = Platform.select({
  ios: "Inter-Medium",
  android: "Inter_500Medium",
  default: "System",
});

export const SANS_BOLD = Platform.select({
  ios: "Inter-SemiBold",
  android: "Inter_600SemiBold",
  default: "System",
});

const typographyBase = {
  // Hero display — fragrance-ad large
  display: {
    fontFamily: SERIF,
    fontSize: 42,
    lineHeight: 50,
    letterSpacing: -0.5,
    fontWeight: "400",
  },
  // Page title
  h1: {
    fontFamily: SERIF,
    fontSize: 34,
    lineHeight: 42,
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
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.1,
  },
  // Body text
  body: {
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0.1,
  },
  bodySecondary: {
    fontFamily: SANS,
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  // Small text
  caption: {
    fontFamily: SANS_MEDIUM,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  // Eyebrow / overline
  label: {
    fontFamily: SANS_BOLD,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  // CTA button
  button: {
    fontFamily: SANS_BOLD,
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
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
  xs: 6,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 72,
  screen: 24,    // horizontal screen padding
  section: 40,   // between content sections
  gutter: 20,    // between cards in a row
};

// ═══════════════════════════════════════════════════════
// BORDER RADIUS — Glass card aesthetic
// ═══════════════════════════════════════════════════════

export const BORDER_RADIUS = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 28,
  xxl: 36,
  full: 9999,
};

// ═══════════════════════════════════════════════════════
// GLASS CARD — Reusable glass morphism styles
// ═══════════════════════════════════════════════════════

export const getGlassStyle = (palette) => {
  const isDark = palette?.background === DARK_PALETTE.background;
  return {
    backgroundColor: isDark ? "rgba(20,15,28,0.55)" : "rgba(255,255,255,0.70)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.35)",
    borderRadius: BORDER_RADIUS.xl,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: isDark ? "#000" : "#1A1118",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.35 : 0.08,
          shadowRadius: 24,
        }
      : { elevation: 6 }),
  };
};

// ═══════════════════════════════════════════════════════
// SHADOWS — Deep, cinematic
// ═══════════════════════════════════════════════════════

export const getShadows = (palette) => {
  const shadowColor = palette?.shadow ?? "#000";
  const isLight = palette?.background === LIGHT_PALETTE.background;
  return {
    small: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isLight ? 0.06 : 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      default: {},
    }),
    medium: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isLight ? 0.10 : 0.40,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
      default: {},
    }),
    large: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: isLight ? 0.12 : 0.50,
        shadowRadius: 32,
      },
      android: { elevation: 10 },
      default: {},
    }),
    glow: Platform.select({
      ios: {
        shadowColor: palette?.primary || "#C4567A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.30,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
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
  const isDark = p === DARK_PALETTE;
  return {
    dark: isDark,
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
        fontWeight: '800',
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

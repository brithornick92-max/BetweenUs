// utils/theme.js — Velvet Glass & Apple Editorial Design System
// Obsidian surfaces · Deep Crimson accents · Liquid Silver · Heavy squircles · Editorial typography

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
// SEMANTIC TOKEN PALETTES — Crimson & Obsidian
// ═══════════════════════════════════════════════════════

export const DARK_PALETTE = {
  // Deep, pitch-dark obsidian environments
  background: "#0A0A0C",
  surface: "#131016",          // subtle elevation
  surface2: "#1C1C1E",         // apple native dark mode surface
  surfaceElevated: "#2C2C2E",  // layered elements
  surfaceGlass: "rgba(28,28,30,0.70)", // pure frosted glass

  // Stark, crisp white text
  text: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.78)",
  textMuted: "rgba(255,255,255,0.48)",
  textGlow: "rgba(210,18,26,0.92)",

  // Feather-light glass borders
  border: "rgba(255,255,255,0.12)",
  borderGlass: "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.05)",

  // Deep Crimson & Liquid Silver — passionate, high-contrast, modern
  primary: "#D2121A",          // sexy red — primary CTAs, active states
  primaryMuted: "#900C0F",     // deep crimson — secondary states, pressed
  primaryGlow: "rgba(210,18,26,0.35)",
  accent: "#E5E5E7",           // liquid silver — replaces all gold
  accentMuted: "rgba(229,229,231,0.40)",

  // Semantic
  danger: "#D2121A",
  success: "#34C759",          // apple native success green
  shadow: "#000000",
  overlay: "rgba(10,10,12,0.85)",
};

export const LIGHT_PALETTE = {
  // Stark, crisp white environments
  background: "#FFFFFF",
  surface: "#F2F2F7",          // apple native light mode secondary
  surface2: "#E5E5EA",         
  surfaceElevated: "#FFFFFF",
  surfaceGlass: "rgba(255,255,255,0.80)",

  // Deep obsidian text
  text: "#000000",
  textSecondary: "rgba(0,0,0,0.75)",
  textMuted: "rgba(0,0,0,0.47)",
  textGlow: "rgba(210,18,26,0.9)",

  border: "rgba(0,0,0,0.08)",
  borderGlass: "rgba(0,0,0,0.05)",
  divider: "rgba(0,0,0,0.04)",

  primary: "#D2121A",
  primaryMuted: "#900C0F",
  primaryGlow: "rgba(210,18,26,0.25)",
  accent: "#8E8E93",           // liquid silver (darkened for light mode contrast)
  accentMuted: "rgba(142,142,147,0.28)",

  danger: "#D2121A",
  success: "#34C759",
  shadow: "#000000",
  overlay: "rgba(255,255,255,0.65)",
};

// Legacy: COLORS mapping for backward compatibility
// All legacy "gold" keys now map to the new Liquid Silver accent to prevent breaking changes
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
  wineMuted: "#900C0F",
  wineDeep: "#4E0820",
  error: DARK_PALETTE.danger,
  warmCharcoal: DARK_PALETTE.background,
  obsidian: DARK_PALETTE.background,
  charcoal: DARK_PALETTE.surface,
  deepPlum: "#0A0A0C",
  pureWhite: DARK_PALETTE.text,
  cream: DARK_PALETTE.text,
  softGray: DARK_PALETTE.textMuted,
  champagneGold: DARK_PALETTE.accent,       // Re-mapped to Silver
  roseCopper: DARK_PALETTE.primary,
  classicGold: DARK_PALETTE.accent,         // Re-mapped to Silver
  mutedGold: DARK_PALETTE.accentMuted,      // Re-mapped to Silver
  blushRose: DARK_PALETTE.primaryMuted,
  highlight: DARK_PALETTE.accent,
  plumVignette: "#0A0A0C",
  blushRoseLight: DARK_PALETTE.primaryMuted,
  deepRed: DARK_PALETTE.primary,
  beetroot: "#900C0F",
  roseGold: DARK_PALETTE.primaryMuted,
  platinum: DARK_PALETTE.accent,
};

// ═══════════════════════════════════════════════════════
// GRADIENTS — Velvet Glass Bridges
// ═══════════════════════════════════════════════════════

export const getGradients = (palette) => {
  const p = palette || DARK_PALETTE;
  const isDark = p.background === DARK_PALETTE.background;

  return {
    screenBackground: [p.background, isDark ? "#1A0205" : "#F9F4F4", p.background],
    glass: [
      isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
      isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)"
    ],
    glassSubtle: [
      isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
      isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)"
    ],
    accentBloom: [p.primaryGlow, "transparent"],
    cta: [p.primary, p.primaryMuted],
    ctaGlow: [p.primaryGlow, "transparent"],
    wineCTA: [p.primary, p.primaryMuted],
    plumVignette: [isDark ? "#1A0205" : "#F9F4F4", p.background],
    background: [p.background, p.background],
    surface: [
      isDark ? "rgba(28,28,30,0.82)" : "rgba(242,242,247,0.92)",
      isDark ? "rgba(28,28,30,0.95)" : "rgba(242,242,247,0.98)"
    ],
    primary: [p.primary, p.primaryMuted],
    secondary: [p.surface2, p.primary],
    silver: [p.accent, isDark ? "#8E8E93" : "#C7C7CC"], // Replaced Gold
    chrome: [p.text, p.text + "CC"], // Replaced Champagne
  };
};

export const GRADIENTS = getGradients(DARK_PALETTE);

// ═══════════════════════════════════════════════════════
// TYPOGRAPHY — Editorial Elegance
// SANS: Heavy system UI fonts (crisp, modern, tight tracking)
// SERIF: Elegant displays (romantic, editorial)
// ═══════════════════════════════════════════════════════

export const SYSTEM_FONT = Platform.select({
  ios: "System",
  android: "Roboto",
  default: "sans-serif",
});

export const SERIF = Platform.select({
  ios: "DMSerifDisplay-Regular",
  android: "DMSerifDisplay_400Regular",
  default: "serif",
});

export const SERIF_ACCENT = SERIF; 
export const SANS = SYSTEM_FONT;
export const SANS_MEDIUM = SYSTEM_FONT;
export const SANS_BOLD = SYSTEM_FONT;

const typographyBase = {
  // Hero display — Crisp System Sans / Heavy Tracking
  display: {
    fontFamily: SYSTEM_FONT,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -1.5,
    fontWeight: "900",
  },
  // Page title
  h1: {
    fontFamily: SYSTEM_FONT,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.2,
    fontWeight: "900",
  },
  // Section header
  h2: {
    fontFamily: SYSTEM_FONT,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    fontWeight: "800",
  },
  // Card title / subsection
  h3: {
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.5,
    fontWeight: "800",
  },
  // Body text
  body: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17, 
    lineHeight: 26,
    letterSpacing: -0.2,
    fontWeight: "500",
  },
  bodySecondary: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: -0.1,
    fontWeight: "500",
  },
  // Small text
  caption: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
    fontWeight: "600",
  },
  // Eyebrow / overline
  label: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold', default: SYSTEM_FONT }),
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "900",
  },
  // CTA button
  button: {
    fontFamily: SYSTEM_FONT,
    fontSize: 18,
    letterSpacing: -0.3,
    fontWeight: "900",
  },
};

export const TYPOGRAPHY = {
  ...typographyBase,
  body: { ...typographyBase.body, color: COLORS.textPrimary },
  bodySecondary: { ...typographyBase.bodySecondary, color: COLORS.textSecondary },
  caption: { ...typographyBase.caption, color: COLORS.textTertiary },
  label: { ...typographyBase.label, color: COLORS.textSecondary },
};

// Consistent screen-level title style used across all screens
export const SCREEN_TITLE_STYLE = {
  fontFamily: SYSTEM_FONT,
  fontSize: 36,
  fontWeight: '900',
  letterSpacing: -1.2,
  lineHeight: 42,
};

// ═══════════════════════════════════════════════════════
// SPACING — Generous Breathing Room
// ═══════════════════════════════════════════════════════

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 48,
  screen: 24,    
  section: 32,   
  gutter: 16,    
};

// ═══════════════════════════════════════════════════════
// BORDER RADIUS — Apple Squircles
// ═══════════════════════════════════════════════════════

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28, // Deep iOS Squircle for large cards/modals
  full: 9999,
};

// ═══════════════════════════════════════════════════════
// GLASS CARD — Reusable glass morphism styles
// ═══════════════════════════════════════════════════════

export const getGlassStyle = (palette) => {
  const isDark = palette.background === DARK_PALETTE.background;
  return {
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
    borderWidth: 1.5,
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
    borderRadius: BORDER_RADIUS.xxl,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: isDark ? "#000000" : "#131016",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.3 : 0.06,
          shadowRadius: 24,
        }
      : { elevation: 4 }),
  };
};

// ═══════════════════════════════════════════════════════
// SHADOWS — Deep, clean iOS native shadows
// ═══════════════════════════════════════════════════════

export const getShadows = (palette) => {
  const isDark = palette?.background === DARK_PALETTE.background;
  const shadowColor = isDark ? "#000000" : "#131016";
  const opacityMod = isDark ? 0.4 : 1;

  return {
    small: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06 * opacityMod,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      default: {},
    }),
    medium: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08 * opacityMod,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
    large: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15 * opacityMod,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
      default: {},
    }),
    glow: Platform.select({
      ios: {
        shadowColor: palette?.primary || "#D2121A",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
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
// ANIMATION — Native, fast, springy
// ═══════════════════════════════════════════════════════

export const ANIMATION = { fast: 200, normal: 350, slow: 500, glacial: 800 };
export const Z_INDEX = { base: 0, card: 5, overlay: 10, modal: 1000 };

// ═══════════════════════════════════════════════════════
// NAVIGATION THEME HELPERS
// ═══════════════════════════════════════════════════════

export const getNavigationTheme = (palette) => {
  const p = palette || DARK_PALETTE;
  const isDark = p.background === DARK_PALETTE.background;

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
        fontFamily: SYSTEM_FONT,
        fontWeight: '500',
      },
      medium: {
        fontFamily: SYSTEM_FONT,
        fontWeight: '600',
      },
      bold: {
        fontFamily: SYSTEM_FONT,
        fontWeight: '800',
      },
      heavy: {
        fontFamily: SYSTEM_FONT,
        fontWeight: '900',
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
  SYSTEM_FONT,
  withAlpha,
  getGlassStyle,
  getGradients,
  getShadows,
  getNavigationTheme,
};

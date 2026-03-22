// utils/theme.js — Midnight Intimacy & Apple Editorial Design System
// Deep plum surfaces · Wine accents · Heavy squircles · Native shadows · Editorial typography

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
// SEMANTIC TOKEN PALETTES — Midnight Intimacy
// ═══════════════════════════════════════════════════════

export const DARK_PALETTE = {
  // Near-black with a rich plum-velvet undertone — like a darkened bedroom
  background: "#09060B",
  surface: "#140F19",          // deep velvet plum — cards, inputs
  surface2: "#1D1524",         // rich aubergine — secondary surfaces
  surfaceElevated: "#261C2E",  // layered velvet — modals, overlays
  surfaceGlass: "rgba(29,21,36,0.70)", // plum-velvet frosted glass

  // Warm petal cream — glowing, intimate
  text: "#F8EDE8",
  textSecondary: "rgba(248,237,232,0.78)",
  textMuted: "rgba(248,237,232,0.48)",
  textGlow: "rgba(195,17,61,0.92)",

  // Feather-light velvet borders
  border: "rgba(255,255,255,0.08)",
  borderGlass: "rgba(255,255,255,0.06)",
  divider: "rgba(255,255,255,0.045)",

  // Sexy Red & Champagne Gold — passionate, desire-forward
  primary: "#C3113D",          // sexy red — primary CTAs, active states, desire
  primaryMuted: "#A00D31",     // deep berry-red — secondary states, pressed
  primaryGlow: "rgba(195,17,61,0.35)",
  accent: "#D4AA7E",           // warm champagne gold — glowing, sensual
  accentMuted: "rgba(212,170,126,0.40)",

  // Semantic
  danger: "#C3113D",
  success: "#4E7A55",
  shadow: "#09060B",
  overlay: "rgba(9,6,11,0.82)",
};

export const LIGHT_PALETTE = {
  // Warm candlelight parchment — like a letter written by firelight
  background: "#FAF4EE",
  surface: "#FFFCF7",          // warm cream white
  surface2: "#F3E9DF",         // parchment tint
  surfaceElevated: "#FFFCF7",
  surfaceGlass: "rgba(255,252,247,0.80)",

  // Deep near-black with a plum undertone
  text: "#1C1019",
  textSecondary: "rgba(28,16,25,0.75)",
  textMuted: "rgba(28,16,25,0.47)",
  textGlow: "rgba(195,17,61,0.9)",

  border: "rgba(28,16,25,0.07)",
  borderGlass: "rgba(28,16,25,0.048)",
  divider: "rgba(28,16,25,0.044)",

  primary: "#C3113D",
  primaryMuted: "#A00D31",
  primaryGlow: "rgba(195,17,61,0.25)",
  accent: "#D4AA7E",
  accentMuted: "rgba(212,170,126,0.28)",

  danger: "#C3113D",
  success: "#4E7A55",
  shadow: "#1C1019",
  overlay: "rgba(250,244,238,0.65)",
};

// Legacy: COLORS mapping for backward compatibility
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
  wineMuted: "#780D2A",
  wineDeep: "#4E0820",
  error: DARK_PALETTE.danger,
  warmCharcoal: DARK_PALETTE.background,
  obsidian: DARK_PALETTE.background,
  charcoal: DARK_PALETTE.surface,
  deepPlum: "#1A0C1E",
  pureWhite: DARK_PALETTE.text,
  cream: DARK_PALETTE.text,
  softGray: DARK_PALETTE.textMuted,
  champagneGold: DARK_PALETTE.accent,
  roseCopper: DARK_PALETTE.primary,
  classicGold: DARK_PALETTE.accent,
  mutedGold: DARK_PALETTE.accentMuted,
  blushRose: DARK_PALETTE.primaryMuted,
  highlight: DARK_PALETTE.accent,
  plumVignette: "#1A0C1E",
  blushRoseLight: DARK_PALETTE.primaryMuted,
  deepRed: DARK_PALETTE.primary,
  beetroot: "#780D2A",
  roseGold: DARK_PALETTE.primaryMuted,
  platinum: "rgba(245,234,230,0.9)",
};

// ═══════════════════════════════════════════════════════
// GRADIENTS — Velvet Glass Bridges
// ═══════════════════════════════════════════════════════

export const getGradients = (palette) => {
  const p = palette || DARK_PALETTE;
  const isDark = p.background === DARK_PALETTE.background;

  return {
    screenBackground: [p.background, isDark ? "#0C0912" : "#F0E6D8", p.background],
    glass: [
      isDark ? "rgba(27,18,33,0.68)" : "rgba(255,252,247,0.80)",
      isDark ? "rgba(19,13,23,0.78)" : "rgba(243,233,223,0.88)"
    ],
    glassSubtle: [
      isDark ? "rgba(27,18,33,0.42)" : "rgba(255,252,247,0.52)",
      isDark ? "rgba(19,13,23,0.52)" : "rgba(243,233,223,0.58)"
    ],
    accentBloom: [p.primaryGlow, "transparent"],
    cta: [p.primary, p.primaryMuted],
    ctaGlow: [p.primaryGlow, "transparent"],
    wineCTA: [p.primary, p.primaryMuted],
    plumVignette: [isDark ? "#1A0C1E" : "#EDE3D5", p.background],
    background: [p.background, p.background],
    surface: [
      isDark ? "rgba(27,18,33,0.82)" : "rgba(255,252,247,0.92)",
      isDark ? "rgba(19,13,23,0.88)" : "rgba(243,233,223,0.96)"
    ],
    primary: [p.primary, p.primaryMuted],
    secondary: [p.surface2, p.primary],
    gold: [p.accent, isDark ? "#9A7040" : "#DEC896"],
    champagne: [p.text, p.text + "CC"],
  };
};

export const GRADIENTS = getGradients(DARK_PALETTE);

// ═══════════════════════════════════════════════════════
// TYPOGRAPHY — Editorial Elegance
// SANS: Heavy system UI fonts (crisp, modern)
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
  // Hero display — Romantic Serif
  display: {
    fontFamily: SERIF,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.2,
    fontWeight: "400",
  },
  // Page title — Romantic Serif
  h1: {
    fontFamily: SERIF,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: -0.2,
    fontWeight: "400",
  },
  // Section header — Romantic Serif
  h2: {
    fontFamily: SERIF,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0,
    fontWeight: "400",
  },
  // Card title / subsection — Crisp System Sans
  h3: {
    fontFamily: SYSTEM_FONT,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
    fontWeight: "700",
  },
  // Body text — Crisp System Sans
  body: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17, 
    lineHeight: 24,
    letterSpacing: -0.2,
    fontWeight: "400",
  },
  bodySecondary: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
    fontWeight: "500",
  },
  // Small text
  caption: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
    fontWeight: "500",
  },
  // Eyebrow / overline
  label: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  // CTA button
  button: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "700",
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
  screen: 20,    
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
    backgroundColor: isDark ? "rgba(28,21,32,0.65)" : "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(19,16,22,0.05)",
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
  const opacityMod = isDark ? 0.4 : 1; // Boost opacity heavily on dark so the shadow reads against charcoal

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
        shadowOpacity: 0.12 * opacityMod,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
      default: {},
    }),
    glow: Platform.select({
      ios: {
        shadowColor: palette?.primary || "#C3113D",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
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
        fontWeight: '400',
      },
      medium: {
        fontFamily: SYSTEM_FONT,
        fontWeight: '500',
      },
      bold: {
        fontFamily: SYSTEM_FONT,
        fontWeight: '700',
      },
      heavy: {
        fontFamily: SYSTEM_FONT,
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
  SYSTEM_FONT,
  withAlpha,
  getGlassStyle,
  getGradients,
  getShadows,
  getNavigationTheme,
};

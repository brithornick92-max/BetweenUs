// utils/theme.js - Enhanced Luxury Edition
import { Platform } from "react-native";

export const COLORS = {
  deepRed: "#B22222",
  beetroot: "#99004C",
  blushRose: "#F7BEEF",
  blushRoseLight: "#FFD6E8",
  mutedGold: "#D4AF37",
  deepPlum: "#2B0F1E",
  charcoal: "#1A1A1A",
  warmCharcoal: "#121212",
  softCream: "#FFF4E8",
  creamSubtle: "rgba(255, 244, 232, 0.7)",
  pureWhite: "#FFFFFF",
  pureBlack: "#000000",
  success: "#4CAF50",
  error: "#FF5252",

  // Luxury Accent Palette
  champagneGold: "#F7E7CE",
  roseGold: "#B76E79",
  platinum: "#E5E4E2",
  obsidian: "#0B0B0B",
};

export const GRADIENTS = {
  primary: [COLORS.blushRose, COLORS.beetroot],
  action: [COLORS.blushRoseLight, COLORS.blushRose],
  
  // Luxury Gradients
  goldShimmer: [COLORS.champagneGold, COLORS.mutedGold, COLORS.champagneGold],
  roseDepth: [COLORS.blushRoseLight, COLORS.blushRose, COLORS.beetroot],
  darkElegance: [COLORS.obsidian, COLORS.warmCharcoal, COLORS.deepPlum],
  lightAiry: [COLORS.softCream, COLORS.pureWhite, COLORS.blushRoseLight + "30"],
};

// Glassmorphism Design Tokens
export const GLASS = {
  light: {
    background: "rgba(255, 255, 255, 0.7)",
    border: "rgba(255, 255, 255, 0.3)",
    blur: 60,
    shadow: {
      color: "#000",
      offset: { width: 0, height: 12 },
      opacity: 0.08,
      radius: 24,
    },
  },
  dark: {
    background: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.15)",
    blur: 40,
    shadow: {
      color: "#000",
      offset: { width: 0, height: 12 },
      opacity: 0.3,
      radius: 24,
    },
  },
  intense: {
    light: {
      background: "rgba(255, 255, 255, 0.9)",
      border: "rgba(255, 255, 255, 0.5)",
      blur: 80,
    },
    dark: {
      background: "rgba(255, 255, 255, 0.1)",
      border: "rgba(255, 255, 255, 0.25)",
      blur: 60,
    },
  },
};

export const lightTheme = {
  dark: false,
  colors: {
    background: COLORS.softCream,
    surface: COLORS.pureWhite,
    surfaceSecondary: COLORS.blushRose + "30",
    primary: COLORS.deepRed,
    accent: COLORS.beetroot,
    text: COLORS.charcoal,
    textSecondary: "rgba(26,26,26,0.6)",
    border: "rgba(178,34,34,0.12)",
    card: COLORS.pureWhite,
    blushRose: COLORS.blushRose,
    deepPlum: COLORS.deepPlum,
    mutedGold: COLORS.mutedGold,
    success: COLORS.success,
    error: COLORS.error,

    // Glass variants
    glass: GLASS.light.background,
    glassBorder: GLASS.light.border,
  },
  glass: GLASS.light,
};

export const darkTheme = {
  dark: true,
  colors: {
    background: COLORS.pureBlack,
    surface: COLORS.charcoal,
    surfaceSecondary: "rgba(255,255,255,0.05)",
    primary: COLORS.deepRed,
    accent: COLORS.blushRose,
    text: COLORS.softCream,
    textSecondary: "rgba(255,244,232,0.6)",
    border: "rgba(255,255,255,0.12)",
    card: COLORS.warmCharcoal,
    blushRose: COLORS.blushRose,
    deepPlum: COLORS.deepPlum,
    mutedGold: COLORS.mutedGold,
    success: COLORS.success,
    error: COLORS.error,

    // Glass variants
    glass: GLASS.dark.background,
    glassBorder: GLASS.dark.border,
  },
  glass: GLASS.dark,
};

// Typography System - Editorial/Magazine Style
export const TYPOGRAPHY = {
  // Display - Hero headlines
  display: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
      default: "serif",
    }),
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -0.5,
    fontWeight: "700",
  },

  // Headers
  h1: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
      default: "serif",
    }),
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.3,
    fontWeight: "700",
  },

  h2: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
      default: "serif",
    }),
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
  },

  h3: {
    fontFamily: "Inter-SemiBold",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },

  // Body Text
  body: {
    fontFamily: "Inter-Regular",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },

  bodyEmphasis: {
    fontFamily: "Inter-Medium",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },

  // Pull Quotes / Editorial
  pullQuote: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
      default: "serif",
    }),
    fontSize: 20,
    lineHeight: 32,
    fontStyle: "italic",
    fontWeight: "600",
  },

  // Small Text
  caption: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    fontWeight: "400",
  },

  captionEmphasis: {
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    fontWeight: "600",
  },

  // Labels
  label: {
    fontFamily: "Inter-Bold",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "700",
  },

  // Buttons
  button: {
    fontFamily: "Inter-Bold",
    fontSize: 16,
    letterSpacing: 0.5,
    fontWeight: "700",
  },

  buttonSmall: {
    fontFamily: "Inter-Bold",
    fontSize: 14,
    letterSpacing: 1,
    fontWeight: "700",
  },
};

// Spacing System - 8pt Grid
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border Radius - Luxury Curves
export const BORDER_RADIUS = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
  full: 999,
};

// Shadow System - Layered Depth
export const SHADOWS = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  small: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),

  medium: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),

  large: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
    },
    android: {
      elevation: 10,
    },
    default: {},
  }),

  puffy: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.25,
      shadowRadius: 32,
    },
    android: {
      elevation: 14,
    },
    default: {},
  }),

  // Glass-specific shadows
  glass: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
};

// Animation Timings
export const ANIMATION = {
  fast: 200,
  normal: 300,
  slow: 500,
  slower: 800,

  spring: {
    damping: 15,
    stiffness: 150,
  },

  springBouncy: {
    damping: 10,
    stiffness: 100,
  },
};

// Z-Index Layers
export const Z_INDEX = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 300,
  popover: 400,
  toast: 500,
};

// Export helper function for glassmorphism styles
export const getGlassStyle = (isDark = false, intense = false) => {
  const config = intense
    ? isDark ? GLASS.intense.dark : GLASS.intense.light
    : isDark ? GLASS.dark : GLASS.light;

  return {
    backgroundColor: config.background,
    borderWidth: 1,
    borderColor: config.border,
    ...Platform.select({
      ios: config.shadow || SHADOWS.glass,
      android: { elevation: intense ? 6 : 4 },
    }),
  };
};

/**
 * useThemedStyles — returns themed style overrides for use with static StyleSheets.
 * Use: style={[styles.container, themed.bg]}
 * Avoids recreating full StyleSheets on theme change for better performance.
 */
import { useMemo } from "react";
import { useTheme } from "../context/ThemeContext";

export function useThemedStyles() {
  const { colors } = useTheme();
  return useMemo(
    () => ({
      bg: { backgroundColor: colors.background },
      surface: { backgroundColor: colors.surface },
      surface2: { backgroundColor: colors.surface2 },
      text: { color: colors.text },
      textMuted: { color: colors.textMuted },
      border: { borderColor: colors.border },
      primary: { color: colors.primary },
      primaryBg: { backgroundColor: colors.primary },
      primaryMutedBg: { backgroundColor: colors.primary + "15" },
      primarySoftBg: { backgroundColor: colors.primary + "12" },
      primaryLightBg: { backgroundColor: colors.primary + "08" },
      divider: { backgroundColor: colors.divider },
      ctaOnDark: { backgroundColor: colors.text, color: colors.background },
      ctaOnLight: { backgroundColor: colors.text, color: colors.background },
      cardBorder: { borderColor: colors.border },
      surfaceBorder: { borderColor: colors.border, backgroundColor: colors.surface2 + "99" },
    }),
    [colors]
  );
}

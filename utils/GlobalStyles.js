// File: utils/GlobalStyles.js
import { StyleSheet, Platform } from "react-native";
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from "./theme";

/**
 * GLOBAL STYLES — Apple Editorial structure + Midnight Intimacy palette
 * Romantic, moody contrast · Heavy system typography · Squircles · Flush layouts
 */

export const GlobalStyles = StyleSheet.create({
  /* ----------------------------- Layout ----------------------------- */
  screen: {
    flex: 1,
    backgroundColor: COLORS.background, // Deep ink-black / warm cream
  },

  safeArea: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: 160, // Critical padding to clear the bottom Velvet Glass tab bar
  },

  center: {
    justifyContent: "center",
    alignItems: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  /* ----- Sections with generous spacing ----- */
  section: {
    paddingHorizontal: SPACING.screen,
    paddingVertical: SPACING.section,
  },

  sectionCentered: {
    paddingHorizontal: SPACING.screen,
    paddingVertical: SPACING.section,
    alignItems: "center",
  },

  /* ----------------------------- Text ----------------------------- */
  h1: {
    ...TYPOGRAPHY.display,
    color: COLORS.text,
  },

  h2: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },

  body: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },

  caption: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
  },

  muted: {
    color: COLORS.textMuted,
  },

  accent: {
    color: COLORS.primary, // Sexy red #D2121A — desire, warmth, intimacy
  },

  /* ----------------------------- Cards / Surfaces ----------------------------- */
  card: {
    backgroundColor: COLORS.surface, // Charcoal Plum
    borderRadius: 24, // Deep iOS Squircle
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },

  glassCard: {
    backgroundColor: COLORS.surfaceGlass, // Translucent plum glass
    borderRadius: 24,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    ...SHADOWS.medium,
  },

  elevatedCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 24,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },

  /* ----------------------------- Inputs ----------------------------- */
  input: {
    backgroundColor: COLORS.surface2, // Slightly elevated plum for inputs
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === "ios" ? 16 : SPACING.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 17, // Native iOS Body Size
    ...TYPOGRAPHY.body,
  },

  inputLabel: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.sm,
    color: COLORS.textSecondary,
    paddingLeft: 4, // Align visually with input padding
  },

  /* ----------------------------- Buttons ----------------------------- */
  buttonPrimary: {
    backgroundColor: COLORS.primary, // Sexy red #D2121A — primary CTA
    borderRadius: BORDER_RADIUS.full, // Perfect pill shape
    overflow: "hidden",
    height: 56, // Taller native touch target
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.glow, // Subtle romantic bloom behind the primary button
  },

  buttonOutline: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.primaryMuted, // Muted wine border
    backgroundColor: "transparent",
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ----------------------------- Separators ----------------------------- */
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.lg,
  },

  spacerSm: { height: SPACING.sm },
  spacerMd: { height: SPACING.md },
  spacerLg: { height: SPACING.lg },
  spacerXl: { height: SPACING.xl },

  /* ----------------------------- Headers ----------------------------- */
  headerContainer: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    alignItems: "flex-start", // Editorial flush-left preference
  },

  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    textAlign: "left",
  },

  headerSubtitle: {
    ...TYPOGRAPHY.bodySecondary,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: "left",
  },

  /* ----------------------------- Pills / Tags ----------------------------- */
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary + "15", // Sexy red wash — rgba(195,17,61,0.08)
    borderWidth: 1,
    borderColor: COLORS.primaryMuted + "30",
  },

  tagText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary, // #D2121A
    fontWeight: "700",
  },
});

export default GlobalStyles;

// File: utils/GlobalStyles.js
import { StyleSheet, Platform } from "react-native";
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from "./theme";

/**
 * GLOBAL STYLES — Between Us
 * Purpose:
 * - Normalize layout spacing
 * - Provide reusable typography & surface patterns
 * - Keep screens visually consistent
 */

export const GlobalStyles = StyleSheet.create({
  /* ----------------------------- Layout ----------------------------- */
  screen: {
    flex: 1,
    backgroundColor: COLORS.warmCharcoal,
  },

  safeArea: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
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

  /* ----------------------------- Text ----------------------------- */
  h1: {
    ...TYPOGRAPHY.display,
    color: COLORS.softCream,
  },

  h2: {
    ...TYPOGRAPHY.h2,
    color: COLORS.softCream,
  },

  body: {
    ...TYPOGRAPHY.body,
    color: COLORS.creamSubtle,
  },

  caption: {
    ...TYPOGRAPHY.caption,
    color: COLORS.creamSubtle,
  },

  muted: {
    color: "rgba(255,255,255,0.5)",
  },

  accent: {
    color: COLORS.blushRose,
  },

  /* ----------------------------- Cards / Surfaces ----------------------------- */
  card: {
    backgroundColor: COLORS.deepPlum,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    ...SHADOWS.small,
  },

  glassCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    ...SHADOWS.medium,
  },

  elevatedCard: {
    backgroundColor: COLORS.charcoal,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.large,
  },

  /* ----------------------------- Inputs ----------------------------- */
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === "ios" ? SPACING.md : SPACING.sm,
    color: COLORS.softCream,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  inputLabel: {
    ...TYPOGRAPHY.caption,
    marginBottom: 6,
    color: COLORS.creamSubtle,
  },

  /* ----------------------------- Buttons ----------------------------- */
  buttonPrimary: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
  },

  buttonOutline: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.blushRose + "80",
    backgroundColor: "transparent",
  },

  /* ----------------------------- Separators ----------------------------- */
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: SPACING.md,
  },

  spacerSm: { height: SPACING.sm },
  spacerMd: { height: SPACING.md },
  spacerLg: { height: SPACING.lg },

  /* ----------------------------- Headers ----------------------------- */
  headerContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.softCream,
    letterSpacing: 1,
  },

  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.blushRose,
    marginTop: 4,
  },

  /* ----------------------------- Pills / Tags ----------------------------- */
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.blushRose + "20",
  },

  tagText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.blushRose,
    fontWeight: "700",
  },
});

export default GlobalStyles;

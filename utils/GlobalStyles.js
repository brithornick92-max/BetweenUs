// File: utils/GlobalStyles.js
import { StyleSheet } from "react-native";
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from "./theme";

/**
 * GLOBAL STYLES — Between Us · Midnight Intimacy
 * Charcoal-plum surfaces · wine accents · 8pt grid · minimal shadows
 */

export const GlobalStyles = StyleSheet.create({
  /* ----------------------------- Layout ----------------------------- */
  screen: {
    flex: 1,
    backgroundColor: COLORS.inkBlack,
  },

  safeArea: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: SPACING.xxxl,
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

  /* ----- Sections with generous 8pt-grid spacing ----- */
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
    color: "rgba(242,233,230,0.4)",
  },

  accent: {
    color: COLORS.mulberry,
  },

  /* ----------------------------- Cards / Surfaces ----------------------------- */
  card: {
    backgroundColor: COLORS.charcoalPlum,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    ...SHADOWS.small,
  },

  glassCard: {
    backgroundColor: "rgba(28,21,32,0.5)",
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    ...SHADOWS.small,
  },

  elevatedCard: {
    backgroundColor: COLORS.surfacePlum,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.medium,
  },

  /* ----------------------------- Inputs ----------------------------- */
  input: {
    backgroundColor: "rgba(28,21,32,0.6)",
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === "ios" ? 14 : SPACING.sm,
    color: COLORS.softCream,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    fontSize: 15,
    ...TYPOGRAPHY.bodySecondary,
  },

  inputLabel: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.sm,
    color: COLORS.mulberry,
  },

  /* ----------------------------- Buttons ----------------------------- */
  buttonPrimary: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
    height: 52,
  },

  buttonOutline: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.wineMuted,
    backgroundColor: "transparent",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ----------------------------- Separators ----------------------------- */
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
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
    alignItems: "center",
  },

  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.softCream,
    textAlign: "center",
  },

  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.mulberry,
    marginTop: 8,
    textAlign: "center",
  },

  /* ----------------------------- Pills / Tags ----------------------------- */
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.wine + "15",
  },

  tagText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.mulberry,
    fontWeight: "600",
  },
});

export default GlobalStyles;

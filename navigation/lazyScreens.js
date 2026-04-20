/**
 * Lazy Screen Registry
 *
 * Deferred require() getters for React Navigation's `getComponent` prop.
 * Each function is only called when the screen is first navigated to,
 * keeping the startup bundle small.
 *
 * ⚠️  DO NOT convert these to top-level imports — that defeats lazy loading.
 *     This file is intentionally structured with inline require() calls.
 *
 * Every screen is wrapped with ScreenErrorBoundary so a crash in one screen
 * cannot propagate up to the navigation tree or root error boundary.
 */

import { withScreenErrorBoundary } from "../components/ScreenErrorBoundary";

// ─── Main screens ───────────────────────────────────────────────────
export const Achievements = () => withScreenErrorBoundary(require("../screens/AchievementsScreen").default, "Achievements");
export const DateNightDetail = () => withScreenErrorBoundary(require("../screens/DateNightDetailScreen").default, "DateNightDetail");
export const HeatLevel = () => withScreenErrorBoundary(require("../screens/HeatLevelScreen").default, "HeatLevel");
export const JournalHome = () => withScreenErrorBoundary(require("../screens/JournalHomeScreen").default, "JournalHome");
export const JournalEntry = () => withScreenErrorBoundary(require("../screens/JournalEntryScreen").default, "JournalEntry");
export const VibeSignal = () => withScreenErrorBoundary(require("../screens/VibeSignalScreen").default, "VibeSignal");
export const Settings = () => withScreenErrorBoundary(require("../screens/SettingsScreen").default, "Settings");
export const SavedMoments = () => withScreenErrorBoundary(require("../screens/SavedMomentsScreen").default, "SavedMoments");
export const AddMemory = () => withScreenErrorBoundary(require("../screens/AddMemoryScreen").default, "AddMemory");

// ─── Legal / info ───────────────────────────────────────────────────
export const Terms = () => withScreenErrorBoundary(require("../screens/TermsScreen").default, "Terms");
export const PrivacyPolicy = () => withScreenErrorBoundary(require("../screens/PrivacyPolicyScreen").default, "PrivacyPolicy");
export const FAQ = () => withScreenErrorBoundary(require("../screens/FAQScreen").default, "FAQ");
export const EULA = () => withScreenErrorBoundary(require("../screens/EULAScreen").default, "EULA");
export const ExportData = () => withScreenErrorBoundary(require("../screens/ExportDataScreen").default, "ExportData");
export const DeleteAccount = () => withScreenErrorBoundary(require("../screens/DeleteAccountScreen").default, "DeleteAccount");

// ─── Intimacy ───────────────────────────────────────────────────────
export const IntimacyPositions = () => withScreenErrorBoundary(require("../screens/IntimacyPositionsScreen").default, "IntimacyPositions");

// ─── Couples Quiz ───────────────────────────────────────────────────
export const CouplesQuiz = () => withScreenErrorBoundary(require("../screens/CouplesQuizScreen").default, "CouplesQuiz");

// ─── Dev / Preview ──────────────────────────────────────────────────


// ─── Settings sub-screens ───────────────────────────────────────────
export const PartnerNamesSettings = () => withScreenErrorBoundary(require("../screens/PartnerNamesSettingsScreen").default, "PartnerNamesSettings");
export const HeatLevelSettings = () => withScreenErrorBoundary(require("../screens/HeatLevelSettingsScreen").default, "HeatLevelSettings");
export const NotificationSettings = () => withScreenErrorBoundary(require("../screens/NotificationSettingsScreen").default, "NotificationSettings");

export const PrivacySecuritySettings = () => withScreenErrorBoundary(require("../screens/PrivacySecuritySettingsScreen").default, "PrivacySecuritySettings");
export const SetPin = () => withScreenErrorBoundary(require("../screens/SetPinScreen").default, "SetPin");
export const SyncSetup = () => withScreenErrorBoundary(require("../screens/SyncSetupScreen").default, "SyncSetup");
export const ResetPassword = () => withScreenErrorBoundary(require("../screens/ResetPasswordScreen").default, "ResetPassword");

// ─── Pairing ────────────────────────────────────────────────────────
export const PairingQRCode = () => withScreenErrorBoundary(require("../screens/PairingQRCodeScreen").default, "PairingQRCode");
export const PairingScan = () => withScreenErrorBoundary(require("../screens/PairingScanScreen").default, "PairingScan");
export const JoinWithCode = () => withScreenErrorBoundary(require("../screens/JoinWithCodeScreen").default, "JoinWithCode");

// ─── Premium / paywall ──────────────────────────────────────────────
export const YearReflection = () => withScreenErrorBoundary(require("../screens/YearReflectionScreen").default, "YearReflection");

// ─── Modal screens ──────────────────────────────────────────────────
export const PromptAnswer = () => withScreenErrorBoundary(require("../screens/PromptAnswerScreen").default, "PromptAnswer");
export const Reveal = () => withScreenErrorBoundary(require("../screens/RevealScreen").default, "Reveal");
export const RevenueCatPaywall = () => withScreenErrorBoundary(require("../components/RevenueCatPaywall").default, "RevenueCatPaywall");
export const CustomerCenter = () => withScreenErrorBoundary(require("../components/CustomerCenter").default, "CustomerCenter");


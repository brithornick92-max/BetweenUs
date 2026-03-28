/**
 * Lazy Screen Registry
 *
 * Deferred require() getters for React Navigation's `getComponent` prop.
 * Each function is only called when the screen is first navigated to,
 * keeping the startup bundle small.
 *
 * ⚠️  DO NOT convert these to top-level imports — that defeats lazy loading.
 *     This file is intentionally structured with inline require() calls.
 */

// ─── Main screens ───────────────────────────────────────────────────
export const DateNightDetail = () => require("../screens/DateNightDetailScreen").default;
export const HeatLevel = () => require("../screens/HeatLevelScreen").default;
export const JournalEntry = () => require("../screens/JournalEntryScreen").default;
export const VibeSignal = () => require("../screens/VibeSignalScreen").default;
export const EditorialPrompt = () => require("../screens/EditorialPromptScreen").default;
export const NightRitual = () => require("../screens/NightRitualScreen").default;
export const Settings = () => require("../screens/SettingsScreen").default;
export const AdaptiveHome = () => require("../components/AdaptiveHomeScreen").default;

// ─── Legal / info ───────────────────────────────────────────────────
export const Terms = () => require("../screens/TermsScreen").default;
export const PrivacyPolicy = () => require("../screens/PrivacyPolicyScreen").default;
export const FAQ = () => require("../screens/FAQScreen").default;
export const EULA = () => require("../screens/EULAScreen").default;
export const ExportData = () => require("../screens/ExportDataScreen").default;
export const DeleteAccount = () => require("../screens/DeleteAccountScreen").default;

// ─── Settings sub-screens ───────────────────────────────────────────
export const PartnerNamesSettings = () => require("../screens/PartnerNamesSettingsScreen").default;
export const HeatLevelSettings = () => require("../screens/HeatLevelSettingsScreen").default;
export const NotificationSettings = () => require("../screens/NotificationSettingsScreen").default;
export const RitualReminders = () => require("../screens/RitualRemindersScreen").default;
export const PrivacySecuritySettings = () => require("../screens/PrivacySecuritySettingsScreen").default;
export const SetPin = () => require("../screens/SetPinScreen").default;
export const SyncSetup = () => require("../screens/SyncSetupScreen").default;

// ─── Pairing ────────────────────────────────────────────────────────
export const PairingQRCode = () => require("../screens/PairingQRCodeScreen").default;
export const PairingScan = () => require("../screens/PairingScanScreen").default;
export const JoinWithCode = () => require("../screens/JoinWithCodeScreen").default;

// ─── Love notes ─────────────────────────────────────────────────────
export const LoveNotesInbox = () => require("../screens/LoveNotesInboxScreen").default;
export const ComposeLoveNote = () => require("../screens/ComposeLoveNoteScreen").default;
export const LoveNoteDetail = () => require("../screens/LoveNoteDetailScreen").default;

// ─── Premium / paywall ──────────────────────────────────────────────
export const PromptLibrary = () => require("../screens/PromptLibraryScreen").default;
export const Paywall = () => require("../screens/PaywallScreen").default;
export const Premium = () => require("../screens/PremiumScreen").default;
export const InsideJokes = () => require("../screens/InsideJokesScreen").default;
export const YearReflection = () => require("../screens/YearReflectionScreen").default;

// ─── Modal screens ──────────────────────────────────────────────────
export const PromptAnswer = () => require("../screens/PromptAnswerScreen").default;
export const Reveal = () => require("../screens/RevealScreen").default;
export const RevenueCatPaywall = () => require("../components/RevenueCatPaywall").default;
export const CustomerCenter = () => require("../components/CustomerCenter").default;

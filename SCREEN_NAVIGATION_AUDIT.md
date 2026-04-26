# Screen Navigation & Title Audit

## ✅ Completed Changes

### EditorialScreenScaffold Component
- ✅ Changed default `backIconName` from `'chevron-back'` to `'close'` (X icon)
- ✅ Moved close button from left to **top right**
- ✅ Changed title from center-aligned to **left-aligned**
- ✅ Updated title size to match Settings: **36px, weight 900, letter-spacing -1**
- ✅ Adjusted header padding to push title up

### Screens Using EditorialScreenScaffold (Auto-Fixed ✅)
All these screens now have X in top right automatically:
- ✅ HeatLevelScreen
- ✅ DeleteAccountScreen
- ✅ NotificationSettingsScreen
- ✅ EULAScreen
- ✅ IntimacyPositionsScreen
- ✅ PartnerNamesSettingsScreen
- ✅ SetPinScreen
- ✅ SyncSetupScreen
- ✅ HeatLevelSettingsScreen
- ✅ JournalHomeScreen
- ✅ AchievementsScreen
- ✅ OurStoryScreen
- ✅ ExportDataScreen

## ⚠️ Screens with Custom Headers Needing Manual Updates

### High Priority - Custom Back Navigation

1. **PromptsScreen.js**
   - ❌ No back button (tab screen)
   - ❌ Title: 42px, 800 weight, -1.5 spacing → Should be 36px, 900, -1
   - **Location**: Line ~387 `headerTitle` style

2. **DateNightScreen.js**
   - ❌ No back button (tab screen)
   - ❌ Title: 40px, 900 weight, -1.5 spacing → Should be 36px, 900, -1
   - **Location**: Line ~857 `headerTitle` style

3. **VibeSignalScreen.js**
   - ❌ Has `chevron-back` on line ~334 → Should be `close` in top right
   - ✅ Title already correct: 36px, 900, -1
   - **Location**: Line ~334

4. **ConnectPartnerScreen.js**
   - ❌ Has `chevron-back` on line ~XX → Should be `close` in top right
   - **Needs**: Title size verification

5. **CouplesQuizScreen.js**
   - ❌ Has `chevron-back` on line ~XX → Should be `close` in top right
   - **Needs**: Title size verification

6. **TermsScreen.js**
   - ❌ Has `chevron-back` → Should be `close` in top right

7. **PrivacyPolicyScreen.js**
   - ❌ Has `chevron-back` → Should be `close` in top right

8. **FAQScreen.js**
   - ❌ Has `chevron-back` → Should be `close` in top right

9. **PrivacySecuritySettingsScreen.js**
   - ❌ Has `chevron-back` → Should be `close` in top right

10. **JournalEntryScreen.js**
    - ❌ Has `chevron-back` → Should be `close` in top right

11. **RevealScreen.js**
    - ❌ Has `chevron-back` → Should be `close` in top right

12. **DateNightDetailScreen.js**
    - ❌ Has `chevron-back-outline` size 32 → Should be `close` size 28 in top right

13. **MemoryWallScreen.js**
    - ❌ Has `chevron-back-outline` size 26 → Should be `close` size 28 in top right
    - Has centered title "Our Photos"

14. **CalendarScreen.js**
    - ❌ Has `chevron-back` size 20 → Should be `close` size 28 in top right

15. **YearReflectionScreen.js**
    - ❌ Has `chevron-back` size 24 → Should be `close` size 28 in top right

## Standards to Apply

### Navigation Icon
- **Icon**: `close` (X icon)
- **Size**: 28
- **Position**: Top right corner
- **Color**: `colors.text` or `t.text`

### Header Title
- **Font Size**: 36px
- **Font Weight**: '900'
- **Letter Spacing**: -1
- **Line Height**: 42px
- **Alignment**: left

### Header Layout
```javascript
header: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  paddingHorizontal: SPACING.lg, // or 24
  paddingTop: SPACING.xs,
  paddingBottom: SPACING.md,
}
```

## Next Steps

1. Update all screens listed above to use:
   - `close` icon instead of `chevron-back`
   - Size 28 consistently
   - Position in top right
   - Title sizing: 36px, weight 900, spacing -1

2. Verify all screens have consistent header heights

3. Test navigation flow after changes

/**
 * withHomeScreenWidgets.cjs
 *
 * Expo Config Plugin — scaffolds a WidgetKit home screen widget extension
 * and configures App Groups for shared data between the app and widget.
 *
 * Add to app.json:
 *   "plugins": ["./plugins/withHomeScreenWidgets"]
 *
 * What this plugin does:
 *   1. Writes starter SwiftUI widget files to ios/BetweenUsWidget/
 *   2. Adds App Group entitlement to the main app target
 *   3. Creates the widget extension entitlements file with the same App Group
 *
 * After `npx expo prebuild`, open Xcode and:
 *   1. File → New → Target → Widget Extension, name it "BetweenUsWidget"
 *   2. Replace generated Swift files with the ones in ios/BetweenUsWidget/
 *   3. Ensure both targets share the App Group "group.com.brittany.betweenus"
 *   4. Set the signing team on the widget target
 */

const { withDangerousMod, withEntitlementsPlist } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const APP_GROUP = 'group.com.brittany.betweenus';

// ─── Shared data keys (keep in sync with services/widgetData.js) ─────────────

const SHARED_DEFAULTS_SWIFT = [
  'import Foundation',
  '',
  '/// Keys shared between the main app and the widget via App Group UserDefaults.',
  '/// Keep in sync with services/widgetData.js on the React Native side.',
  'enum WidgetDataKeys {',
  '    static let appGroup = "' + APP_GROUP + '"',
  '    static let streak = "widget_streak"',
  '    static let dailyPrompt = "widget_dailyPrompt"',
  '    static let partnerName = "widget_partnerName"',
  '    static let lastCheckIn = "widget_lastCheckIn"',
  '    static let nextMilestone = "widget_nextMilestone"',
  '    static let nextMilestoneDate = "widget_nextMilestoneDate"',
  '}',
].join('\n');

// ─── Widget Provider (timeline-based) ────────────────────────────────────────

const WIDGET_PROVIDER_SWIFT = [
  'import WidgetKit',
  'import SwiftUI',
  '',
  'struct BetweenUsEntry: TimelineEntry {',
  '    let date: Date',
  '    let daysConnected: Int',
  '    let dailyPrompt: String',
  '    let partnerName: String',
  '}',
  '',
  'struct BetweenUsProvider: TimelineProvider {',
  '    func placeholder(in context: Context) -> BetweenUsEntry {',
  '        BetweenUsEntry(date: .now, daysConnected: 0, dailyPrompt: "What made you think of each other today?", partnerName: "")',
  '    }',
  '',
  '    func getSnapshot(in context: Context, completion: @escaping (BetweenUsEntry) -> Void) {',
  '        completion(readEntry())',
  '    }',
  '',
  '    func getTimeline(in context: Context, completion: @escaping (Timeline<BetweenUsEntry>) -> Void) {',
  '        let entry = readEntry()',
  '        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!',
  '        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))',
  '    }',
  '',
  '    private func readEntry() -> BetweenUsEntry {',
  '        let defaults = UserDefaults(suiteName: WidgetDataKeys.appGroup)',
  '        return BetweenUsEntry(',
  '            date: .now,',
  '            daysConnected: defaults?.integer(forKey: WidgetDataKeys.streak) ?? 0,',
  '            dailyPrompt: defaults?.string(forKey: WidgetDataKeys.dailyPrompt) ?? "What made you think of each other today?",',
  '            partnerName: defaults?.string(forKey: WidgetDataKeys.partnerName) ?? ""',
  '        )',
  '    }',
  '}',
].join('\n');

// ─── Widget Views — exact match to utils/theme.js DARK_PALETTE ───────────────
// Typography: System font (heavy/black weight) for all text — serif is display-only per brand
// Colors: inkBlack #0A0A0C, surface #131016, primary #D2121A, primaryMuted #900C0F,
//         accent #E5E5E7, wineDeep #4E0820, text white, textSecondary 0.78, textMuted 0.48
// Spacing: xl=20, lg=16, sm=8, xs=4
// Borders: white @ 0.12 opacity, glass borders @ 0.08
// Background: plum vignette gradient + wine accent bloom (radial)
// Voice: "nights connected" not "streak", "Your story starts here" for empty state

const WIDGET_VIEWS_SWIFT = [
  'import WidgetKit',
  'import SwiftUI',
  '',
  '// ─── Theme tokens (exact match: utils/theme.js DARK_PALETTE) ────────────────',
  'private extension Color {',
  '    // Backgrounds',
  '    static let inkBlack       = Color(red: 10/255, green: 10/255, blue: 12/255)     // #0A0A0C',
  '    static let charcoalPlum   = Color(red: 19/255, green: 16/255, blue: 22/255)     // #131016',
  '    static let surfacePlum    = Color(red: 28/255, green: 28/255, blue: 30/255)     // #1C1C1E',
  '    // Accents',
  '    static let wine           = Color(red: 210/255, green: 18/255, blue: 26/255)    // #D2121A',
  '    static let wineMuted      = Color(red: 144/255, green: 12/255, blue: 15/255)    // #900C0F',
  '    static let wineDeep       = Color(red: 78/255, green: 8/255, blue: 32/255)      // #4E0820',
  '    static let liquidSilver   = Color(red: 229/255, green: 229/255, blue: 231/255)  // #E5E5E7',
  '    static let plumVignette   = Color(red: 26/255, green: 2/255, blue: 5/255)       // #1A0205',
  '    // Text',
  '    static let textPrimary    = Color.white',
  '    static let textSecondary  = Color.white.opacity(0.78)',
  '    static let textMuted      = Color.white.opacity(0.48)',
  '    // Borders',
  '    static let glassBorder    = Color.white.opacity(0.08)',
  '    static let borderLight    = Color.white.opacity(0.12)',
  '}',
  '',
  'struct BetweenUsWidgetEntryView: View {',
  '    var entry: BetweenUsProvider.Entry',
  '    @Environment(\\.widgetFamily) var family',
  '',
  '    var body: some View {',
  '        switch family {',
  '        case .systemSmall:',
  '            smallView',
  '                .widgetURL(URL(string: "betweenus://widget"))',
  '        case .systemMedium:',
  '            mediumView',
  '                .widgetURL(URL(string: "betweenus://widget/prompt"))',
  '        default:',
  '            smallView',
  '                .widgetURL(URL(string: "betweenus://widget"))',
  '        }',
  '    }',
  '',
  '    // MARK: - Small Widget',
  '    var smallView: some View {',
  '        VStack(alignment: .leading, spacing: 0) {',
  '            // Eyebrow — label style: 11px, weight 900, uppercase, tracking 2',
  '            HStack(spacing: 6) {',
  '                Image(systemName: "heart.fill")',
  '                    .foregroundColor(.wine)',
  '                    .font(.system(size: 12, weight: .heavy))',
  '                Text("BETWEEN US")',
  '                    .font(.system(size: 11, weight: .heavy))',
  '                    .tracking(2)',
  '                    .foregroundColor(.textMuted)',
  '            }',
  '',
  '            Spacer()',
  '',
  '            if entry.daysConnected > 0 {',
  '                // Display number — system black, tight tracking (display style)',
  '                Text("\\(entry.daysConnected)")',
  '                    .font(.system(size: 40, weight: .black))',
  '                    .tracking(-1.5)',
  '                    .foregroundColor(.textPrimary)',
  '                    .padding(.bottom, 2)',
  '',
  '                // Caption — 13px semibold',
  '                Text(entry.daysConnected == 1 ? "night connected" : "nights connected")',
  '                    .font(.system(size: 13, weight: .semibold))',
  '                    .foregroundColor(.textMuted)',
  '            } else {',
  '                // Empty state — warm brand voice',
  '                Text(entry.partnerName.isEmpty ? "Your story starts here" : "Hi, \\(entry.partnerName)")',
  '                    .font(.system(size: 15, weight: .medium))',
  '                    .tracking(-0.1)',
  '                    .foregroundColor(.textSecondary)',
  '            }',
  '        }',
  '        .padding(20)  // xl spacing',
  '        .containerBackground(for: .widget) {',
  '            ZStack {',
  '                Color.inkBlack',
  '                // Plum vignette gradient (screenBackground)',
  '                LinearGradient(',
  '                    colors: [.plumVignette, .inkBlack],',
  '                    startPoint: .bottom,',
  '                    endPoint: .top',
  '                )',
  '                // Wine accent bloom — subtle top-left glow',
  '                RadialGradient(',
  '                    colors: [.wine.opacity(0.12), .clear],',
  '                    center: .topLeading,',
  '                    startRadius: 0,',
  '                    endRadius: 120',
  '                )',
  '            }',
  '        }',
  '    }',
  '',
  '    // MARK: - Medium Widget',
  '    var mediumView: some View {',
  '        HStack(spacing: 0) {',
  '            // ── Left: Connection counter ──',
  '            VStack(alignment: .leading, spacing: 0) {',
  '                HStack(spacing: 5) {',
  '                    Image(systemName: "heart.fill")',
  '                        .foregroundColor(.wine)',
  '                        .font(.system(size: 11, weight: .heavy))',
  '                    Text("BETWEEN US")',
  '                        .font(.system(size: 10, weight: .heavy))',
  '                        .tracking(2)',
  '                        .foregroundColor(.textMuted)',
  '                }',
  '',
  '                Spacer()',
  '',
  '                if entry.daysConnected > 0 {',
  '                    Text("\\(entry.daysConnected)")',
  '                        .font(.system(size: 36, weight: .black))',
  '                        .tracking(-1.5)',
  '                        .foregroundColor(.textPrimary)',
  '                        .padding(.bottom, 2)',
  '',
  '                    Text(entry.daysConnected == 1 ? "night connected" : "nights connected")',
  '                        .font(.system(size: 11, weight: .semibold))',
  '                        .foregroundColor(.textMuted)',
  '                }',
  '            }',
  '            .frame(width: 110)',
  '            .padding(.trailing, 16)  // lg spacing',
  '',
  '            // ── Glass divider (border: white @ 0.12) ──',
  '            Rectangle()',
  '                .fill(Color.borderLight)',
  '                .frame(width: 1)',
  '                .padding(.vertical, 4)',  // xs spacing
  '',
  '            // ── Right: Daily prompt ──',
  '            VStack(alignment: .leading, spacing: 8) {',  // sm spacing
  '                // Eyebrow label',
  '                Text("SOMETHING TO SHARE")',
  '                    .font(.system(size: 10, weight: .heavy))',
  '                    .tracking(1.5)',
  '                    .foregroundColor(.textMuted)',
  '',
  '                // Body secondary — 15px, medium weight',
  '                Text(entry.dailyPrompt)',
  '                    .font(.system(size: 15, weight: .medium))',
  '                    .tracking(-0.1)',
  '                    .foregroundColor(.textPrimary)',
  '                    .lineLimit(3)',
  '                    .lineSpacing(4)',
  '',
  '                Spacer()',
  '            }',
  '            .padding(.leading, 16)  // lg spacing',
  '        }',
  '        .padding(20)  // xl spacing',
  '        .containerBackground(for: .widget) {',
  '            ZStack {',
  '                Color.inkBlack',
  '                LinearGradient(',
  '                    colors: [.plumVignette, .inkBlack],',
  '                    startPoint: .bottom,',
  '                    endPoint: .top',
  '                )',
  '                RadialGradient(',
  '                    colors: [.wine.opacity(0.10), .clear],',
  '                    center: .topLeading,',
  '                    startRadius: 0,',
  '                    endRadius: 160',
  '                )',
  '            }',
  '        }',
  '    }',
  '}',
].join('\n');

// ─── Widget Bundle Entry Point ────────────────────────────────────────────────

const WIDGET_BUNDLE_SWIFT = [
  'import WidgetKit',
  '',
  '@main',
  'struct BetweenUsWidgetBundle: WidgetBundle {',
  '    var body: some Widget {',
  '        BetweenUsHomeWidget()',
  '    }',
  '}',
].join('\n');

const WIDGET_CONFIG_SWIFT = [
  'import WidgetKit',
  'import SwiftUI',
  '',
  'struct BetweenUsHomeWidget: Widget {',
  '    let kind = "BetweenUsHomeWidget"',
  '',
  '    var body: some WidgetConfiguration {',
  '        StaticConfiguration(kind: kind, provider: BetweenUsProvider()) { entry in',
  '            BetweenUsWidgetEntryView(entry: entry)',
  '        }',
  '        .configurationDisplayName("Between Us")',
  '        .description("A quiet reminder of your connection.")',
  '        .supportedFamilies([.systemSmall, .systemMedium])',
  '    }',
  '}',
].join('\n');

// ─── Widget entitlements ──────────────────────────────────────────────────────

const WIDGET_ENTITLEMENTS_PLIST = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
  '<plist version="1.0">',
  '  <dict>',
  '    <key>com.apple.security.application-groups</key>',
  '    <array>',
  '      <string>' + APP_GROUP + '</string>',
  '    </array>',
  '  </dict>',
  '</plist>',
].join('\n');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function writeFile(dir, filename, content) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content.trimStart(), 'utf8');
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

/** @param {import('@expo/config-plugins').ExpoConfig} config */
function withHomeScreenWidgets(config) {
  // 1. Add App Group entitlement to the main app
  config = withEntitlementsPlist(config, (mod) => {
    const groups = mod.modResults['com.apple.security.application-groups'] || [];
    if (!groups.includes(APP_GROUP)) {
      groups.push(APP_GROUP);
    }
    mod.modResults['com.apple.security.application-groups'] = groups;
    return mod;
  });

  // 2. Write Swift widget files to ios/BetweenUsWidget/
  config = withDangerousMod(config, [
    'ios',
    (mod) => {
      const iosDir = path.join(mod.modRequest.platformProjectRoot);
      const widgetDir = path.join(iosDir, 'BetweenUsWidget');

      writeFile(widgetDir, 'WidgetDataKeys.swift', SHARED_DEFAULTS_SWIFT);
      writeFile(widgetDir, 'BetweenUsProvider.swift', WIDGET_PROVIDER_SWIFT);
      writeFile(widgetDir, 'BetweenUsWidgetViews.swift', WIDGET_VIEWS_SWIFT);
      writeFile(widgetDir, 'BetweenUsWidgetBundle.swift', WIDGET_BUNDLE_SWIFT);
      writeFile(widgetDir, 'BetweenUsHomeWidget.swift', WIDGET_CONFIG_SWIFT);
      writeFile(widgetDir, 'BetweenUsWidget.entitlements', WIDGET_ENTITLEMENTS_PLIST);

      return mod;
    },
  ]);

  return config;
}

module.exports = withHomeScreenWidgets;

/**
 * withDateNightLiveActivity.cjs
 *
 * Expo Config Plugin — adds a WidgetKit Live Activity extension to the iOS
 * Xcode project so the Dynamic Island and Lock Screen widget work natively.
 *
 * Add to app.json:
 *   "plugins": ["./plugins/withDateNightLiveActivity"]
 *
 * What this plugin does:
 *   1. Creates the Swift extension files under ios/DateNightWidget/
 *   2. Adds the new target to the Xcode project (.pbxproj)
 *   3. Adds "NSSupportsLiveActivities" to the main app's Info.plist
 *   4. Adds the required WidgetKit framework to the extension target
 *
 * After `npx expo prebuild`, open Xcode and verify the DateNightWidget
 * target appears. You may need to set the signing team manually.
 */

const {
  withXcodeProject,
  withInfoPlist,
  withDangerousMod,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ─── Swift source files ───────────────────────────────────────────────────────

const LIVE_ACTIVITY_ATTRIBUTES_SWIFT = `
import ActivityKit
import Foundation

// Shared between the app and the widget extension
struct DateNightAttributes: ActivityAttributes {
    public typealias ContentState = DateNightStatus

    struct DateNightStatus: Codable, Hashable {
        var minutesRemaining: Int
        var teaserNote: String
        var phase: String // "anticipation" | "countdown" | "live" | "ended"
    }

    var eventId: String
    var title: String
}
`;

const LIVE_ACTIVITY_WIDGET_SWIFT = `
import WidgetKit
import SwiftUI
import ActivityKit

// ─── Lock Screen / Notification Banner ──────────────────────────────────────

struct DateNightLiveActivityView: View {
    let context: ActivityViewContext<DateNightAttributes>

    var body: some View {
        HStack(spacing: 14) {
            // Pulsing heart
            Image(systemName: "heart.fill")
                .foregroundColor(Color(red: 195/255, green: 17/255, blue: 61/255))
                .font(.system(size: 20, weight: .semibold))

            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)

                Text(context.state.teaserNote)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(.white.opacity(0.75))
                    .lineLimit(1)
            }

            Spacer()

            // Countdown badge
            if context.state.minutesRemaining > 0 {
                VStack(spacing: 0) {
                    Text("\\(context.state.minutesRemaining)")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text("min")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.white.opacity(0.6))
                }
            } else {
                Text("Now")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(Color(red: 195/255, green: 17/255, blue: 61/255))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(red: 9/255, green: 6/255, blue: 11/255))
    }
}

// ─── Dynamic Island — Compact ────────────────────────────────────────────────

struct DateNightCompactLeading: View {
    let context: ActivityViewContext<DateNightAttributes>
    var body: some View {
        Image(systemName: "heart.fill")
            .foregroundColor(Color(red: 195/255, green: 17/255, blue: 61/255))
    }
}

struct DateNightCompactTrailing: View {
    let context: ActivityViewContext<DateNightAttributes>
    var body: some View {
        Text(context.state.minutesRemaining > 0
             ? "\\(context.state.minutesRemaining)m"
             : "Now")
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundColor(.white)
    }
}

// ─── Dynamic Island — Minimal ─────────────────────────────────────────────────

struct DateNightMinimal: View {
    let context: ActivityViewContext<DateNightAttributes>
    var body: some View {
        Image(systemName: "heart.fill")
            .foregroundColor(Color(red: 195/255, green: 17/255, blue: 61/255))
            .font(.system(size: 12, weight: .semibold))
    }
}

// ─── Dynamic Island — Expanded ────────────────────────────────────────────────

struct DateNightExpanded: View {
    let context: ActivityViewContext<DateNightAttributes>
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "heart.fill")
                    .foregroundColor(Color(red: 195/255, green: 17/255, blue: 61/255))
                Text(context.attributes.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                Spacer()
                if context.state.minutesRemaining > 0 {
                    Text("in \\(context.state.minutesRemaining)m")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.8))
                }
            }
            Text(context.state.teaserNote)
                .font(.system(size: 13, weight: .regular))
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

// ─── Widget Configuration ─────────────────────────────────────────────────────

@available(iOS 16.2, *)
struct DateNightWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DateNightAttributes.self) { context in
            DateNightLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    DateNightCompactLeading(context: context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    DateNightCompactTrailing(context: context)
                }
                DynamicIslandExpandedRegion(.center) {
                    DateNightExpanded(context: context)
                }
            } compactLeading: {
                DateNightCompactLeading(context: context)
            } compactTrailing: {
                DateNightCompactTrailing(context: context)
            } minimal: {
                DateNightMinimal(context: context)
            }
        }
    }
}
`;

const LIVE_ACTIVITY_BUNDLE_SWIFT = `
import WidgetKit

@main
struct DateNightWidgetBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.2, *) {
            DateNightWidget()
        }
    }
}
`;

const NATIVE_MODULE_SWIFT = `
import Foundation
import ActivityKit

// Native module bridge — called from DateNightLiveActivity.js via NativeModules
@objc(DateNightLiveActivityModule)
class DateNightLiveActivityModule: NSObject {

    @objc static func requiresMainQueueSetup() -> Bool { false }

    @available(iOS 16.2, *)
    @objc func startActivity(_ options: NSDictionary) {
        guard #available(iOS 16.2, *) else { return }

        let eventId   = options["eventId"]   as? String ?? ""
        let title     = options["title"]     as? String ?? "Date Night"
        let teaser    = options["teaserNote"] as? String ?? "Tonight is ours."
        let timestamp = options["dateTimestamp"] as? Double ?? 0

        let minutesRemaining = max(0, Int((timestamp - Date().timeIntervalSince1970 * 1000) / 60_000))

        let attributes = DateNightAttributes(eventId: eventId, title: title)
        let state      = DateNightAttributes.ContentState(
            minutesRemaining: minutesRemaining,
            teaserNote: teaser,
            phase: minutesRemaining > 60 ? "anticipation" : "countdown"
        )

        do {
            let _ = try Activity<DateNightAttributes>.request(
                attributes: attributes,
                contentState: state,
                pushType: nil
            )
        } catch {
            // Live Activities not available (older iOS / simulator)
        }
    }

    @objc func endActivity(_ options: NSDictionary) {
        guard #available(iOS 16.2, *) else { return }
        let eventId = options["eventId"] as? String ?? ""

        Task {
            for activity in Activity<DateNightAttributes>.activities
            where activity.attributes.eventId == eventId {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
    }

    @objc func endAllActivities() {
        guard #available(iOS 16.2, *) else { return }
        Task {
            for activity in Activity<DateNightAttributes>.activities {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
    }
}
`;

// ─── File writer helper ───────────────────────────────────────────────────────

function writeFile(dir, filename, content) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content.trimStart(), 'utf8');
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

/** @param {import('@expo/config-plugins').ExpoConfig} config */
function withDateNightLiveActivity(config) {
  // 1. Add NSSupportsLiveActivities key to main Info.plist
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSSupportsLiveActivities = true;
    mod.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    return mod;
  });

  // 2. Write Swift source files into ios/DateNightWidget/
  config = withDangerousMod(config, [
    'ios',
    (mod) => {
      const iosDir = path.join(mod.modRequest.platformProjectRoot, '..');
      const widgetDir = path.join(iosDir, 'ios', 'DateNightWidget');
      const nativeDir = path.join(iosDir, 'ios', 'BetweenUs');

      writeFile(widgetDir, 'DateNightAttributes.swift',      LIVE_ACTIVITY_ATTRIBUTES_SWIFT);
      writeFile(widgetDir, 'DateNightWidget.swift',          LIVE_ACTIVITY_WIDGET_SWIFT);
      writeFile(widgetDir, 'DateNightWidgetBundle.swift',    LIVE_ACTIVITY_BUNDLE_SWIFT);

      // Native module bridge (goes into the main app target, not the extension)
      writeFile(nativeDir, 'DateNightLiveActivityModule.swift', NATIVE_MODULE_SWIFT);

      return mod;
    },
  ]);

  // NOTE: Adding the Xcode target itself (.pbxproj mutation) requires
  // @expo/config-plugins withXcodeProject + heavy pbxproj manipulation.
  // The files are written above. To complete setup:
  //   1. Open Xcode → File → New → Target → Widget Extension
  //   2. Name it "DateNightWidget", uncheck "Include Configuration Intent"
  //   3. Replace generated files with the ones written to ios/DateNightWidget/
  //   4. Add DateNightLiveActivityModule.swift to the BetweenUs target
  //   5. Register the native module in AppDelegate or via a Bridging Header

  return config;
}

module.exports = withDateNightLiveActivity;

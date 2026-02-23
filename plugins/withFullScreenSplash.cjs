/**
 * Custom Expo config plugin: withFullScreenSplash
 *
 * Generates a full-screen iOS splash screen that covers the entire display.
 * Replaces the default expo-splash-screen plugin (remove it from your plugins
 * array when using this).
 *
 * What it does:
 *   1. Writes a SplashScreen.storyboard with the imageView pinned to all
 *      four edges (top/bottom/leading/trailing) using scaleAspectFill.
 *   2. Copies assets/splash.png into the xcassets imageset at @1x/@2x/@3x.
 *   3. Creates the SplashScreenBackground named-colour set.
 *
 * Usage in app.json:
 *   "plugins": [
 *     ["./plugins/withFullScreenSplash.cjs", {
 *       "backgroundColor": "#1a0614"
 *     }]
 *   ]
 */
const { withDangerousMod, withInfoPlist } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Hex → 0-1 float for the colour-set JSON ──────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    red: (parseInt(h.substring(0, 2), 16) / 255).toString(),
    green: (parseInt(h.substring(2, 4), 16) / 255).toString(),
    blue: (parseInt(h.substring(4, 6), 16) / 255).toString(),
  };
}

// ── Generate the storyboard XML ───────────────────────────────────────────────
function buildStoryboardXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="24093.7" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="EXPO-VIEWCONTROLLER-1">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="24053.1"/>
        <capability name="Named colors" minToolsVersion="9.0"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="System colors in document resources" minToolsVersion="11.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="EXPO-SCENE-1">
            <objects>
                <viewController storyboardIdentifier="SplashScreenViewController" id="EXPO-VIEWCONTROLLER-1" sceneMemberID="viewController">
                    <view key="view" userInteractionEnabled="NO" contentMode="scaleToFill" insetsLayoutMarginsFromSafeArea="NO" id="EXPO-ContainerView" userLabel="ContainerView">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" flexibleMaxX="YES" flexibleMaxY="YES"/>
                        <subviews>
                            <imageView id="EXPO-SplashScreen" userLabel="SplashScreenBackground" image="SplashScreenLogo" contentMode="scaleAspectFill" clipsSubviews="true" userInteractionEnabled="false" translatesAutoresizingMaskIntoConstraints="false">
                                <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                            </imageView>
                        </subviews>
                        <viewLayoutGuide key="safeArea" id="Rmq-lb-GrQ"/>
                        <constraints>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="top" secondItem="EXPO-ContainerView" secondAttribute="top" id="splashTop"/>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="bottom" secondItem="EXPO-ContainerView" secondAttribute="bottom" id="splashBottom"/>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="leading" secondItem="EXPO-ContainerView" secondAttribute="leading" id="splashLeading"/>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="trailing" secondItem="EXPO-ContainerView" secondAttribute="trailing" id="splashTrailing"/>
                        </constraints>
                        <color key="backgroundColor" name="SplashScreenBackground"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="EXPO-PLACEHOLDER-1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="0.0" y="0.0"/>
        </scene>
    </scenes>
    <resources>
        <image name="SplashScreenLogo" width="341" height="512"/>
        <systemColor name="systemBackgroundColor">
            <color white="1" alpha="1" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"/>
        </systemColor>
        <namedColor name="SplashScreenBackground">
            <color alpha="1.000" blue="0.0784313725490196" green="0.0235294117647059" red="0.101960784313725" customColorSpace="sRGB" colorSpace="custom"/>
        </namedColor>
    </resources>
</document>
`;
}

// ── Write the image assets ────────────────────────────────────────────────────
function writeImageAssets(projectRoot, imagesetDir) {
  const src = path.join(projectRoot, "assets", "splash.png");
  if (!fs.existsSync(src)) {
    console.warn("[withFullScreenSplash] assets/splash.png not found — skipping images");
    return;
  }

  fs.mkdirSync(imagesetDir, { recursive: true });

  const img3x = path.join(imagesetDir, "image@3x.png");
  const img2x = path.join(imagesetDir, "image@2x.png");
  const img1x = path.join(imagesetDir, "image.png");

  // @3x = original 1024x1536
  fs.copyFileSync(src, img3x);

  // @2x = 683x1024
  execSync(`sips -z 1024 683 "${src}" --out "${img2x}"`, { stdio: "ignore" });

  // @1x = 341x512
  execSync(`sips -z 512 341 "${src}" --out "${img1x}"`, { stdio: "ignore" });

  fs.writeFileSync(
    path.join(imagesetDir, "Contents.json"),
    JSON.stringify(
      {
        images: [
          { idiom: "universal", filename: "image.png", scale: "1x" },
          { idiom: "universal", filename: "image@2x.png", scale: "2x" },
          { idiom: "universal", filename: "image@3x.png", scale: "3x" },
        ],
        info: { version: 1, author: "expo" },
      },
      null,
      2
    )
  );
}

// ── Write the named-colour set ────────────────────────────────────────────────
function writeColorSet(colorsetDir, bgColor) {
  fs.mkdirSync(colorsetDir, { recursive: true });
  const rgb = hexToRgb(bgColor);

  fs.writeFileSync(
    path.join(colorsetDir, "Contents.json"),
    JSON.stringify(
      {
        colors: [
          {
            color: {
              components: { alpha: "1.000", ...rgb },
              "color-space": "srgb",
            },
            idiom: "universal",
          },
        ],
        info: { version: 1, author: "expo" },
      },
      null,
      2
    )
  );
}

// ── Main plugin ───────────────────────────────────────────────────────────────
function withFullScreenSplash(config, props = {}) {
  const bgColor = props.backgroundColor || "#1a0614";

  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosDir = path.join(projectRoot, "ios");

      const xcodeproj = fs
        .readdirSync(iosDir)
        .find((f) => f.endsWith(".xcodeproj"));
      const appName = xcodeproj
        ? xcodeproj.replace(".xcodeproj", "")
        : "BetweenUs";

      const appDir = path.join(iosDir, appName);
      const assetsDir = path.join(appDir, "Images.xcassets");

      // 1. Write the storyboard (overwrites whatever expo-splash-screen wrote)
      const storyboardPath = path.join(appDir, "SplashScreen.storyboard");
      fs.writeFileSync(storyboardPath, buildStoryboardXml());

      // 2. Write the image assets (portrait, not square)
      writeImageAssets(projectRoot, path.join(assetsDir, "SplashScreenLogo.imageset"));

      // 3. Write the background colour set
      writeColorSet(path.join(assetsDir, "SplashScreenBackground.colorset"), bgColor);

      console.log("[withFullScreenSplash] Full-screen splash configured");
      return config;
    },
  ]);
}

module.exports = withFullScreenSplash;

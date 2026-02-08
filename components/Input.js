import React, { useMemo, useRef, useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { COLORS, BORDER_RADIUS } from "../utils/theme";

/**
 * High-End Animated Input Component
 * ✅ Theme-aware (optional)
 * ✅ Fixes BlurView fill style
 * ✅ Better light/dark defaults
 */
export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  numberOfLines = 1,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  editable = true,
  error = null,
  helper = null,
  icon = null,
  rightIcon = null,
  onRightIconPress,
  maxLength,
  style,

  // ✅ Optional props you’ll want across the app
  onSubmitEditing,
  returnKeyType,
  autoFocus = false,
  blur = true,

  // ✅ Optional theme hook injection
  // Pass: theme={activeTheme} isDark={isDark}
  theme = null,
  isDark = true,
}) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const palette = useMemo(() => {
    // If no theme is passed, fall back to your global COLORS (dark)
    const t = theme?.colors;

    const baseText = t?.text ?? (isDark ? "#FFFFFF" : "#111111");
    const secondaryText = t?.textSecondary ?? (isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)");
    const border = t?.border ?? (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)");
    const surface = t?.surface ?? (isDark ? "rgba(30,30,30,0.40)" : "rgba(255,255,255,0.75)");
    const surfaceFocused = t?.surfaceSecondary ?? (isDark ? "rgba(40,40,40,0.80)" : "rgba(255,255,255,0.95)");
    const accent = t?.blushRose ?? COLORS.blushRose;
    const err = t?.error ?? COLORS.error;

    const placeholderColor = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
    const helperColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
    const counterColor = isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)";

    return {
      baseText,
      secondaryText,
      border,
      surface,
      surfaceFocused,
      accent,
      err,
      placeholderColor,
      helperColor,
      counterColor,
    };
  }, [theme, isDark]);

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // Error always wins for border color
  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? palette.err : palette.border,
      error ? palette.err : palette.accent,
    ],
  });

  const backgroundColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [palette.surface, palette.surfaceFocused],
  });

  const labelColor = error
    ? palette.err
    : focused
      ? palette.accent
      : palette.secondaryText;

  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={[styles.label, { color: labelColor }]}>{label}</Text>}

      <Animated.View
        style={[
          styles.container,
          { borderColor, backgroundColor },
          multiline && styles.containerMultiline,
          !editable && styles.containerDisabled,
        ]}
      >
        {blur && Platform.OS === "ios" && (
          <BlurView
            intensity={focused ? 15 : 6}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {icon && <View style={styles.icon}>{icon}</View>}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.placeholderColor}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          maxLength={maxLength}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoFocus={autoFocus}
          selectionColor={palette.accent}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            { color: palette.baseText, textAlignVertical: multiline ? "top" : "center" },
          ]}
        />

        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            disabled={!onRightIconPress}
            activeOpacity={0.7}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </Animated.View>

      <View style={styles.footer}>
        {(error || helper) ? (
          <Text style={[styles.helper, { color: error ? palette.err : palette.helperColor }]}>
            {error || helper}
          </Text>
        ) : (
          <View />
        )}

        {typeof maxLength === "number" && (
          <Text style={[styles.counter, { color: palette.counterColor }]}>
            {(value?.length || 0)}/{maxLength}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
    width: "100%",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    overflow: "hidden",
    minHeight: 56,
  },
  containerMultiline: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: 0,
  },
  icon: {
    marginRight: 12,
    opacity: 0.8,
  },
  rightIcon: {
    marginLeft: 12,
    padding: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  helper: {
    fontSize: 12,
    fontWeight: "500",
  },
  counter: {
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});

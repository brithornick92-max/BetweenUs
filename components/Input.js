import React, { useMemo, useRef, useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "../context/ThemeContext";
import { BORDER_RADIUS } from "../utils/theme";

/**
 * High-End Animated Input Component
 * ✅ Theme-aware
 * ✅ FIX: BlurView + Animated stacking on iOS (KEYBOARD / FOCUS ISSUE)
 */

const createStyles = (colors) => StyleSheet.create({
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

  // ✅ must be relative for blur zIndex to behave reliably on iOS
  container: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    overflow: "hidden",
    minHeight: 56,
  },

  // ✅ true background layer
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
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

  onSubmitEditing,
  returnKeyType,
  autoFocus = false,
  blur = true,

  // handy defaults (safe)
  autoCorrect = false,
  keyboardAppearance,
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const palette = useMemo(() => {
    return {
      baseText: colors.text,
      secondaryText: colors.textMuted,
      border: colors.border,
      surface: colors.surface,
      surfaceFocused: colors.surface2,
      accent: colors.primary,
      err: colors.danger,
      placeholderColor: colors.textMuted,
      helperColor: colors.textMuted,
      counterColor: colors.textMuted,
    };
  }, [colors]);

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

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? palette.err : palette.border, error ? palette.err : palette.accent],
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
        // ✅ "box-none" prevents wrapper from blocking touch/focus
        pointerEvents="box-none"
        style={[
          styles.container,
          { borderColor, backgroundColor },
          multiline && styles.containerMultiline,
          !editable && styles.containerDisabled,
        ]}
      >
        {/* ✅ Most reliable fix:
            1) pointerEvents="none" so blur never captures touches
            2) zIndex:-1 so blur is truly BEHIND the TextInput on iOS
            3) container is position:"relative" so zIndex works consistently
        */}
        {blur && Platform.OS === "ios" && (
          <BlurView
            pointerEvents="none"
            intensity={focused ? 15 : 6}
            tint={isDark ? "dark" : "light"}
            style={styles.blurLayer}
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
          autoCorrect={autoCorrect}
          editable={editable}
          maxLength={maxLength}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoFocus={autoFocus}
          selectionColor={palette.accent}
          keyboardAppearance={keyboardAppearance ?? (isDark ? "dark" : "light")}
          accessibilityLabel={label || placeholder}
          accessibilityState={{ disabled: !editable }}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            {
              color: palette.baseText,
              textAlignVertical: multiline ? "top" : "center",
            },
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
        {error || helper ? (
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

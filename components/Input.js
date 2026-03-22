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
import { useTheme } from "../context/ThemeContext";
import { SPACING, withAlpha } from "../utils/theme";

/**
 * High-End Apple Editorial Input Component
 * Sexy Red Intimacy & Velvet Glass Updates Integrated.
 */

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const createStyles = (t, isDark) => StyleSheet.create({
  wrapper: {
    marginVertical: 12,
    width: "100%",
  },
  label: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  container: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20, // Deep Apple Squircle
    borderWidth: 1.5,
    paddingHorizontal: 16,
    overflow: "hidden",
    minHeight: 56, // Apple Standard touch target
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  containerMultiline: {
    alignItems: "flex-start",
    paddingVertical: 16,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 17, // Native iOS Body Size
    fontWeight: "500",
    letterSpacing: -0.2,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: 0,
  },
  icon: {
    marginRight: 12,
  },
  rightIcon: {
    marginLeft: 12,
    padding: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 6,
  },
  helper: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  counter: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    opacity: 0.6,
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
  autoCorrect = false,
  keyboardAppearance,
}) {
  const { colors, isDark } = useTheme();

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    surface: isDark ? "#131016" : "#FFFFFF",
    surfaceSecondary: isDark ? "#1C1520" : "#F2F2F7",
    primary: colors.primary || "#C3113D", // Sexy Red
    text: colors.text,
    subtext: isDark ? "rgba(242,233,230,0.6)" : "rgba(60, 60, 67, 0.6)",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
    danger: "#FF3B30",
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

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
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? t.danger : t.border, 
      error ? t.danger : t.primary
    ],
  });

  const backgroundColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isDark ? "rgba(28,21,32,0.6)" : "#FFFFFF", 
      t.surfaceSecondary
    ],
  });

  const labelColor = error
    ? t.danger
    : focused
      ? t.primary
      : t.subtext;

  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={[styles.label, { color: labelColor }]}>{label}</Text>}

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.container,
          { borderColor, backgroundColor },
          multiline && styles.containerMultiline,
          !editable && styles.containerDisabled,
        ]}
      >
        {blur && Platform.OS === "ios" && (
          <BlurView
            pointerEvents="none"
            intensity={focused ? 25 : 10}
            tint={isDark ? "dark" : "light"}
            style={styles.blurLayer}
          />
        )}

        {icon && (
          <View style={styles.icon}>
            {React.cloneElement(icon, { 
              color: focused ? t.primary : t.subtext,
              size: 20 
            })}
          </View>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.subtext}
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
          selectionColor={t.primary}
          keyboardAppearance={keyboardAppearance ?? (isDark ? "dark" : "light")}
          accessibilityLabel={label || placeholder}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            {
              color: t.text,
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
            {React.cloneElement(rightIcon, { 
              color: t.subtext,
              size: 20 
            })}
          </TouchableOpacity>
        )}
      </Animated.View>

      <View style={styles.footer}>
        {error || helper ? (
          <Text style={[styles.helper, { color: error ? t.danger : t.subtext }]}>
            {error || helper}
          </Text>
        ) : (
          <View />
        )}

        {typeof maxLength === "number" && (
          <Text style={[styles.counter, { color: t.subtext }]}>
            {(value?.length || 0)}/{maxLength}
          </Text>
        )}
      </View>
    </View>
  );
}

// File: navigation/Tabs.js - Premium Tab Navigation
import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { TYPOGRAPHY, withAlpha, SANS_BOLD } from '../utils/theme';

// Tab screens
import HomeScreen from "../screens/HomeScreen";
import PromptsScreen from "../screens/PromptsScreen";
import CalendarScreen from "../screens/CalendarScreen";
import DateNightScreen from "../screens/DateNightScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator();

function AnimatedTabIcon({ routeName, focused, color, size = 24 }) {
  const scale = useSharedValue(focused ? 1.15 : 1);
  const opacity = useSharedValue(focused ? 1 : 0.7);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(focused ? 1 : 0.7, { duration: 200 });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const getIconName = () => {
    switch (routeName) {
      case "Home":
        return focused ? "heart" : "heart-outline";
      case "Prompts":
        return focused ? "chat-processing" : "chat-processing-outline";
      case "Calendar":
        return focused ? "calendar-month" : "calendar-month-outline";
      case "DatePlans":
        return focused ? "glass-wine" : "glass-wine";
      case "Settings":
        return focused ? "tune-variant" : "tune-variant";
      default:
        return focused ? "circle" : "circle-outline";
    }
  };

  return (
    <Animated.View style={[styles.iconContainer, animatedStyle]}>
      <MaterialCommunityIcons
        name={getIconName()}
        size={size}
        color={color}
        style={styles.icon}
      />
    </Animated.View>
  );
}

function PremiumTabBarBackground({ colors, isDark }) {
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: withAlpha(colors.background, 0.94),
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.borderGlass || colors.border,
          },
        ]}
      />
    );
  }

  return (
    <BlurView
      pointerEvents="none"
      intensity={60}
      tint={isDark ? 'dark' : 'light'}
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: withAlpha(colors.background, 0.72) },
      ]}
    />
  );
}

export default function Tabs() {
  const { colors, isDark } = useTheme();

  const handleTabPress = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarIcon: ({ focused, color, size }) => (
          <AnimatedTabIcon
            routeName={route.name}
            focused={focused}
            color={color}
            size={size}
          />
        ),

        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: withAlpha(colors.textMuted, 0.56),

        tabBarStyle: [styles.tabBar, { borderTopColor: colors.borderGlass || withAlpha(colors.border, 0.13) }],
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.tabItem,

        tabBarBackground: () => <PremiumTabBarBackground colors={colors} isDark={isDark} />,

        tabBarHideOnKeyboard: true,
        tabBarVisibilityAnimationConfig: {
          show: { animation: "timing", config: { duration: 400 } },
          hide: { animation: "timing", config: { duration: 400 } },
        },
      })}
      screenListeners={{
        tabPress: handleTabPress,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: "Home" }}
      />
      <Tab.Screen
        name="Prompts"
        component={PromptsScreen}
        options={{ tabBarLabel: "Prompts" }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ tabBarLabel: "Calendar" }}
      />
      <Tab.Screen
        name="DatePlans"
        component={DateNightScreen}
        options={{ tabBarLabel: "Dates" }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: "Settings" }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 82 : 68,
    paddingBottom: Platform.OS === "ios" ? 12 : 8,
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
  },

  tabItem: {
    paddingVertical: 4,
    marginHorizontal: 2,
  },

  label: {
    fontFamily: SANS_BOLD,
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 2,
    textTransform: "uppercase",
  },

  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingVertical: 2,
  },

  icon: {},
});

// File: navigation/Tabs.js - Premium Tab Navigation
// Fully integrated with Apple Editorial & Velvet Glass aesthetic

import React, { useEffect, useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { selection } from '../utils/haptics';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { SPACING } from '../utils/theme';

// Tab screens
import HomeScreen from "../screens/HomeScreen";
import PromptsScreen from "../screens/PromptsScreen";
import CalendarScreen from "../screens/CalendarScreen";
import DateNightScreen from "../screens/DateNightScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator();

// ------------------------------------------------------------------
// ANIMATED TAB ICON
// ------------------------------------------------------------------
function AnimatedTabIcon({ routeName, focused, color, size = 24 }) {
  const scale = useSharedValue(focused ? 1.1 : 1);
  const translateY = useSharedValue(focused ? -2 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.12 : 1, {
      damping: 12,
      stiffness: 200,
    });
    translateY.value = withSpring(focused ? -1 : 0, {
      damping: 12,
      stiffness: 200,
    });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
  }));

  const getIconName = () => {
    switch (routeName) {
      case "Home":
        return focused ? "heart" : "heart-outline";
      case "Prompts":
        return focused ? "chatbubbles" : "chatbubbles-outline";
      case "Calendar":
        return focused ? "calendar" : "calendar-outline";
      case "DatePlans":
        return focused ? "wine" : "wine-outline";
      case "Settings":
        return focused ? "settings" : "settings-outline";
      default:
        return focused ? "ellipse" : "ellipse-outline";
    }
  };

  return (
    <Animated.View style={[styles.iconContainer, animatedStyle]}>
      <Ionicons
        name={getIconName()}
        size={size}
        color={color}
      />
    </Animated.View>
  );
}

// ------------------------------------------------------------------
// PREMIUM TAB BAR BACKGROUND (Apple Velvet Glass)
// ------------------------------------------------------------------
function PremiumTabBarBackground({ isDark }) {
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          },
        ]}
      />
    );
  }

  return (
    <BlurView
      intensity={isDark ? 80 : 95}
      tint={isDark ? 'dark' : 'light'}
      style={StyleSheet.absoluteFill}
    />
  );
}

// ------------------------------------------------------------------
// MAIN TABS COMPONENT
// ------------------------------------------------------------------
export default function Tabs() {
  const { colors, isDark } = useTheme();

  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  }), [colors, isDark]);

  const handleTabPress = () => {
    selection(); // Precise high-end tactile feedback on every tab tap
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarIcon: ({ focused, color }) => (
          <AnimatedTabIcon
            routeName={route.name}
            focused={focused}
            color={color}
            size={24}
          />
        ),

        // Native iOS Active/Inactive Colors
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.subtext,

        tabBarStyle: [
          styles.tabBar, 
          { borderTopColor: t.border }
        ],
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.tabItem,

        tabBarBackground: () => <PremiumTabBarBackground isDark={isDark} />,

        tabBarHideOnKeyboard: true,
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

// ------------------------------------------------------------------
// STYLES - Pure Apple Native Layout
// ------------------------------------------------------------------
const systemFont = Platform.select({ ios: "System", android: "Roboto" });

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 88 : 72,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
    backgroundColor: "transparent", // Managed by BlurView background
  },

  tabItem: {
    paddingVertical: 4,
  },

  label: {
    fontFamily: systemFont,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginTop: 2,
    textTransform: "none", // Apple doesn't typically uppercase tab labels
  },

  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
});

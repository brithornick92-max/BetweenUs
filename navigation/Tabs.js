// navigation/Tabs.js - Premium Tab Navigation
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
  interpolate,
  useSharedValue,
} from "react-native-reanimated";
import { COLORS, TYPOGRAPHY } from "../utils/theme";

// Tab screens
import HomeScreen from "../screens/HomeScreen";
import CalendarScreen from "../screens/CalendarScreen";
import JournalScreen from "../screens/JournalScreen";
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

  // Premium icon mapping with sophisticated variants
  const getIconName = () => {
    switch (routeName) {
      case "Home":
        return focused ? "heart" : "heart-outline";
      case "Calendar":
        return focused ? "calendar-heart" : "calendar-heart-outline";
      case "Journal":
        return focused ? "book-open-variant" : "book-open-outline";
      case "DateNight":
        return focused ? "heart-multiple" : "heart-multiple-outline";
      case "Settings":
        return focused ? "cog" : "cog-outline";
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

// Premium Tab Bar Background Component
function PremiumTabBarBackground() {
  if (Platform.OS === "web") {
    return (
      <View style={styles.webTabBackground} />
    );
  }

  return (
    <BlurView
      intensity={40}
      tint="dark"
      style={[StyleSheet.absoluteFill, styles.blurBackground]}
    />
  );
}

export default function Tabs() {
  const handleTabPress = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarIcon: ({ focused, color, size }) => (
          <AnimatedTabIcon
            routeName={route.name}
            focused={focused}
            color={color}
            size={size}
          />
        ),

        // Premium color scheme
        tabBarActiveTintColor: COLORS?.blushRose ?? "#E6A6B8",
        tabBarInactiveTintColor: COLORS?.creamSubtle ?? "#E8DDC8",
        
        // Premium tab bar styling
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.tabItem,

        // Premium blur background
        tabBarBackground: () => <PremiumTabBarBackground />,

        // Smooth transitions
        tabBarHideOnKeyboard: true,
        tabBarVisibilityAnimationConfig: {
          show: {
            animation: 'timing',
            config: {
              duration: 400,
            },
          },
          hide: {
            animation: 'timing',
            config: {
              duration: 400,
            },
          },
        },
      })}
      screenListeners={{
        tabPress: handleTabPress,
        state: () => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: "Heart",
        }}
      />
      <Tab.Screen 
        name="Calendar" 
        component={CalendarScreen}
        options={{
          tabBarLabel: "Dates",
        }}
      />
      <Tab.Screen 
        name="Journal" 
        component={JournalScreen}
        options={{
          tabBarLabel: "Story",
        }}
      />
      <Tab.Screen 
        name="DateNight" 
        component={DateNightScreen}
        options={{
          tabBarLabel: "Nights",
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          tabBarLabel: "You",
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // Premium tab bar styling
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopWidth: 0.5,
    borderTopColor: `${COLORS?.blushRose ?? "#E6A6B8"}30`, // 19% opacity
    elevation: 0,
    shadowOpacity: 0,
  },

  // Premium tab item styling
  tabItem: {
    paddingVertical: 5,
    marginHorizontal: 2,
  },

  // Premium label styling
  label: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
    ...TYPOGRAPHY.caption,
  },

  // Icon container with premium effects
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 2,
  },

  icon: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Blur background styling
  blurBackground: {
    backgroundColor: `${COLORS?.warmCharcoal ?? "#2A2A2A"}E6`, // 90% opacity fallback
  },

  // Web fallback background
  webTabBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${COLORS?.warmCharcoal ?? "#2A2A2A"}F0`, // 94% opacity
    borderTopWidth: 0.5,
    borderTopColor: `${COLORS?.blushRose ?? "#E6A6B8"}30`,
  },
});

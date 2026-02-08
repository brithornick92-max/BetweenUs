import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { COLORS } from '../utils/theme';

const ThemeContext = createContext({});

// Safe default theme for when context is not available
const DEFAULT_THEME = {
  colors: {
    background: COLORS.warmCharcoal,
    surface: COLORS.deepPlum,
    surfaceSecondary: 'rgba(255,255,255,0.04)',
    text: COLORS.softCream,
    textSecondary: 'rgba(246,242,238,0.60)',
    border: 'rgba(255,255,255,0.08)',
    accent: COLORS.blushRose,
    blushRose: COLORS.blushRose,
    mutedGold: COLORS.mutedGold,
    success: COLORS.success,
    error: COLORS.error,
    warning: COLORS.warning,
  },
  gradients: {
    primary: [COLORS.blushRose, COLORS.mutedGold],
    secondary: [COLORS.warmCharcoal, COLORS.deepPlum + '30'],
  },
  isDark: true,
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  // Return safe default instead of throwing error
  if (!context || !context.colors) {
    console.warn('useTheme: Context not available, using default theme');
    return {
      theme: DEFAULT_THEME,
      isDark: true,
      themeMode: 'dark',
      setTheme: () => {},
      toggleTheme: () => {},
      colors: DEFAULT_THEME.colors,
      gradients: DEFAULT_THEME.gradients,
    };
  }
  
  return context;
};

// Light theme colors
const LIGHT_THEME = {
  colors: {
    background: COLORS.softCream,
    surface: '#FFFFFF',
    surfaceSecondary: 'rgba(0,0,0,0.02)',
    text: COLORS.charcoal,
    textSecondary: 'rgba(51,51,51,0.60)',
    border: 'rgba(0,0,0,0.06)',
    accent: COLORS.blushRose,
    blushRose: COLORS.blushRose,
    mutedGold: COLORS.mutedGold,
    success: COLORS.success,
    error: COLORS.error,
    warning: COLORS.warning,
  },
  gradients: {
    primary: [COLORS.blushRose, COLORS.mutedGold],
    secondary: [COLORS.softCream, COLORS.blushRose + '20'],
  },
  isDark: false,
};

// Dark theme colors
const DARK_THEME = {
  colors: {
    background: COLORS.warmCharcoal,
    surface: COLORS.deepPlum,
    surfaceSecondary: 'rgba(255,255,255,0.04)',
    text: COLORS.softCream,
    textSecondary: 'rgba(246,242,238,0.60)',
    border: 'rgba(255,255,255,0.08)',
    accent: COLORS.blushRose,
    blushRose: COLORS.blushRose,
    mutedGold: COLORS.mutedGold,
    success: COLORS.success,
    error: COLORS.error,
    warning: COLORS.warning,
  },
  gradients: {
    primary: [COLORS.blushRose, COLORS.mutedGold],
    secondary: [COLORS.warmCharcoal, COLORS.deepPlum + '30'],
  },
  isDark: true,
};

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system'); // 'light', 'dark', 'system'
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  // Load saved theme preference
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await storage.get(STORAGE_KEYS.THEME_MODE) || 'system';
        setThemeMode(savedTheme);
        
        if (savedTheme === 'system') {
          setIsDark(systemColorScheme === 'dark');
        } else {
          setIsDark(savedTheme === 'dark');
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      }
    };

    loadThemePreference();
  }, [systemColorScheme]);

  // Update theme when system changes (if using system theme)
  useEffect(() => {
    if (themeMode === 'system') {
      setIsDark(systemColorScheme === 'dark');
    }
  }, [systemColorScheme, themeMode]);

  const setTheme = async (mode) => {
    try {
      setThemeMode(mode);
      await storage.set(STORAGE_KEYS.THEME_MODE, mode);
      
      if (mode === 'system') {
        setIsDark(systemColorScheme === 'dark');
      } else {
        setIsDark(mode === 'dark');
      }
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const toggleTheme = () => {
    const newMode = isDark ? 'light' : 'dark';
    setTheme(newMode);
  };

  const theme = isDark ? DARK_THEME : LIGHT_THEME;

  const value = {
    theme,
    isDark,
    themeMode,
    setTheme,
    toggleTheme,
    colors: theme.colors,
    gradients: theme.gradients,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
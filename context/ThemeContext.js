import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useColorScheme } from "react-native";
import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  getGradients,
  getShadows,
  getNavigationTheme,
} from "../utils/theme";
import { storage } from "../utils/storage";
import { STORAGE_KEYS } from "../utils/storage";

const ThemeContext = createContext(null);

const THEME_MODES = ["auto", "dark", "light"];

/** Auto mode: light 6 AM–8 PM, dark otherwise */
const isNightTime = () => {
  const h = new Date().getHours();
  return h < 6 || h >= 20;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  const systemColorScheme = useColorScheme();

  if (!context) {
    const fallbackPalette = DARK_PALETTE;
    return {
      themeMode: "dark",
      setThemeMode: () => {},
      isDark: true,
      colors: fallbackPalette,
      gradients: getGradients(fallbackPalette),
      shadows: getShadows(fallbackPalette),
      navigationTheme: getNavigationTheme(fallbackPalette),
    };
  }

  return context;
};

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState("dark");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const stored = await storage.get(STORAGE_KEYS.THEME_MODE, "dark");
        if (active && THEME_MODES.includes(stored)) {
          setThemeModeState(stored);
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoaded(true);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const setThemeMode = async (mode) => {
    if (!THEME_MODES.includes(mode)) return;
    setThemeModeState(mode);
    try {
      await storage.set(STORAGE_KEYS.THEME_MODE, mode);
    } catch {
      // ignore
    }
  };

  // Re-evaluate auto mode every minute
  const [autoTick, setAutoTick] = useState(0);
  useEffect(() => {
    if (themeMode !== "auto") return;
    const id = setInterval(() => setAutoTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [themeMode]);

  const palette = useMemo(() => {
    if (themeMode === "auto") return isNightTime() ? DARK_PALETTE : LIGHT_PALETTE;
    return themeMode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
  }, [themeMode, autoTick]);

  const isDark = useMemo(() => palette === DARK_PALETTE, [palette]);

  const gradients = useMemo(() => getGradients(palette), [palette]);
  const shadows = useMemo(() => getShadows(palette), [palette]);
  const navigationTheme = useMemo(() => getNavigationTheme(palette), [palette]);

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      isDark,
      colors: palette,
      gradients,
      shadows,
      navigationTheme,
      loaded,
    }),
    [themeMode, isDark, palette, gradients, shadows, navigationTheme, loaded]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

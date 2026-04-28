/**
 * FilmGrain — Subtle analog texture overlay
 * Velvet Glass & Apple Editorial High-End Updates Integrated.
 * Palette: Deep Crimson, Obsidian, Liquid Silver (Strictly No Gold).
 * Renders a deterministic noise pattern at very low opacity.
 * Gives obsidian backgrounds a tactile, high-end paper feeling.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');

/**
 * Deterministic grid of tiny "ink" dots to simulate film grain.
 * Keeping it pure-View avoids extra dependencies like SVG or Canvas.
 */
const CELL = 12;      // Wider grid = fewer dots
const DOT  = 1.2;     // Smaller, sharper dots for Retina clarity
const COLS = Math.ceil(W / CELL);
const ROWS = Math.ceil(H / CELL);

// Simple deterministic PRNG for consistent texture across renders
const seed = (s) => () => { 
  s = (s * 16807 + 0) % 2147483647; 
  return s / 2147483647; 
};

const FilmGrain = ({ opacity = 0.04 }) => {
  // Disabled to reduce CPU usage and heat generation
  return null;
};

export default React.memo(FilmGrain);

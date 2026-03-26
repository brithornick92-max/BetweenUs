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
const CELL = 8;       // Slightly wider grid for cleaner editorial feel
const DOT  = 1.2;     // Smaller, sharper dots for Retina clarity
const COLS = Math.ceil(W / CELL);
const ROWS = Math.ceil(H / CELL);

// Simple deterministic PRNG for consistent texture across renders
const seed = (s) => () => { 
  s = (s * 16807 + 0) % 2147483647; 
  return s / 2147483647; 
};

const FilmGrain = ({ opacity = 0.04 }) => {
  const { isDark } = useTheme();
  // Crisp white grain for dark obsidian backgrounds; pure black grain for stark light backgrounds
  const dotColor = isDark ? '255,255,255' : '0,0,0';

  const dots = useMemo(() => {
    const rng = seed(77); // New seed for updated distribution
    const result = [];
    
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Render ~25% of cells for a more sparse, premium texture
        if (rng() > 0.25) continue;
        
        // Per-dot opacity variation for organic "paper" depth
        const o = 0.2 + rng() * 0.6; 
        
        // Jitter positioning to break the digital grid
        const jitterX = rng() * (CELL - DOT);
        const jitterY = rng() * (CELL - DOT);

        result.push(
          <View
            key={`${r}-${c}`}
            style={{
              position: 'absolute',
              left: c * CELL + jitterX,
              top:  r * CELL + jitterY,
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              backgroundColor: `rgba(${dotColor},${o})`,
            }}
          />
        );
      }
    }
    return result;
  }, [dotColor]);

  return (
    <View 
      pointerEvents="none" 
      style={[
        StyleSheet.absoluteFill, 
        { 
          opacity,
          backgroundColor: 'transparent',
          zIndex: 9999, // Ensure texture sits atop surfaces for tactile feel
        }
      ]}
    >
      {dots}
    </View>
  );
};

export default React.memo(FilmGrain);

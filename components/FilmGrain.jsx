// components/FilmGrain.jsx — Subtle analog texture overlay
// Renders a static noise pattern at very low opacity to give
// ink-black backgrounds a tactile, warm-paper feeling.
import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// Generate a deterministic grid of tiny dots to simulate film grain.
// Keeping it pure-View avoids extra dependencies (no SVG/Canvas needed).
const CELL = 6;       // grid spacing in px
const DOT  = 1.5;     // dot size
const COLS = Math.ceil(W / CELL);
const ROWS = Math.ceil(H / CELL);

// Simple seeded PRNG for consistent output across renders
const seed = (s) => () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

const FilmGrain = ({ opacity = 0.035 }) => {
  const dots = useMemo(() => {
    const rng = seed(42);
    const result = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Only render ~30% of cells for organic feel
        if (rng() > 0.3) continue;
        const o = 0.15 + rng() * 0.55; // per-dot opacity variation
        result.push(
          <View
            key={`${r}-${c}`}
            style={{
              position: 'absolute',
              left: c * CELL + rng() * 3,
              top:  r * CELL + rng() * 3,
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              backgroundColor: `rgba(242,233,230,${o})`,
            }}
          />
        );
      }
    }
    return result;
  }, []);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {dots}
    </View>
  );
};

export default React.memo(FilmGrain);

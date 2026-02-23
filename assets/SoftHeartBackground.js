// assets/SoftHeartBackground.js
// SVG illustration for a soft, romantic heart background
import React from 'react';
import { Svg, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

export default function SoftHeartBackground({ width = '100%', height = 320, style }) {
  return (
    <Svg width={width} height={height} style={style} viewBox="0 0 400 320">
      <Defs>
        <RadialGradient id="heartGradient" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#F8B6C1" stopOpacity="0.7" />
          <Stop offset="100%" stopColor="#F8B6C1" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx="200"
        cy="160"
        rx="180"
        ry="120"
        fill="url(#heartGradient)"
      />
    </Svg>
  );
}

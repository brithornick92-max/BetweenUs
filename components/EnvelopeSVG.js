import React from "react";
import { View } from "react-native";
import Svg, { Path, Rect, Circle, G, Defs, LinearGradient as SvgGrad, Stop } from "react-native-svg";

// Envelope SVG with heart wax seal
export default function EnvelopeSVG({ width = 280, height = 180, color = "#FFF8F5", border = "#E8D5CC", seal = "#C96B8E" }) {
  // Scale factor relative to 280×180 viewBox
  return (
    <Svg width={width} height={height} viewBox="0 0 280 180" fill="none">
      <Defs>
        <SvgGrad id="envBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} />
          <Stop offset="1" stopColor={border} stopOpacity="0.3" />
        </SvgGrad>
        <SvgGrad id="sealGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={seal} />
          <Stop offset="1" stopColor={seal} stopOpacity="0.7" />
        </SvgGrad>
      </Defs>

      {/* Envelope body */}
      <Rect x="14" y="50" width="252" height="116" rx="14" fill="url(#envBody)" stroke={border} strokeWidth="2" />

      {/* Inner fold lines */}
      <Path d="M14 166 L140 110 L266 166" fill="none" stroke={border} strokeWidth="1.2" opacity="0.5" />

      {/* Envelope flap */}
      <Path d="M14 50 L140 8 L266 50 Z" fill={color} stroke={border} strokeWidth="2" />
      {/* Flap inner shadow */}
      <Path d="M24 50 L140 16 L256 50" fill="none" stroke={border} strokeWidth="0.8" opacity="0.3" />

      {/* Heart wax seal */}
      <G>
        <Circle cx="140" cy="52" r="22" fill="url(#sealGrad)" />
        <Circle cx="140" cy="52" r="20" fill="none" stroke={seal} strokeWidth="1" opacity="0.5" />
        {/* Heart shape inside seal */}
        <Path
          d="M140 62 C140 62 128 53 128 46 C128 42 131 39 135 39 C138 39 140 41 140 41 C140 41 142 39 145 39 C149 39 152 42 152 46 C152 53 140 62 140 62Z"
          fill="#FFF"
          opacity="0.9"
        />
      </G>
    </Svg>
  );
}

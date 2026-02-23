import React from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

// Simple envelope SVG illustration
export default function EnvelopeSVG({ width = 220, height = 140, color = "#fff", border = "#e0cfc2" }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 220 140" fill="none">
      {/* Envelope body */}
      <Rect x="10" y="40" width="200" height="90" rx="12" fill={color} stroke={border} strokeWidth="3" />
      {/* Envelope flap */}
      <Path d="M10 40 L110 10 L210 40 Z" fill={color} stroke={border} strokeWidth="3" />
      {/* Envelope shadow */}
      <Path d="M10 130 L110 80 L210 130" fill="none" stroke={border} strokeWidth="2" />
    </Svg>
  );
}

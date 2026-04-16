/**
 * The Bridge — ip005
 * Standing face to face, holding hands, leaning back to form an arch.
 * Abstract silhouette illustration.
 */
import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

export default function BridgeIllustration({ width = '100%', height = 200, figureAColor = 'rgba(229,229,231,0.55)', figureBColor = '#D2121A' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 250">
      {/* Figure A — standing, leaning back left */}
      <G id="figureA">
        <Circle cx="135" cy="52" r="17" fill={figureAColor} />
        {/* Torso — leaning back */}
        <Path
          d="M135 69 C128 72, 118 85, 112 105 C108 120, 108 138, 115 155 L140 155 C138 138, 138 120, 142 105 C145 90, 142 75, 135 69Z"
          fill={figureAColor}
        />
        {/* Left leg — planted */}
        <Path
          d="M115 150 C112 168, 108 188, 105 210 C104 220, 102 230, 100 238 L115 240 C116 232, 118 222, 118 212 C120 192, 122 172, 125 155Z"
          fill={figureAColor}
        />
        {/* Right leg */}
        <Path
          d="M135 150 C136 168, 138 188, 140 210 C141 220, 142 230, 142 238 L128 240 C128 232, 128 222, 127 212 C126 192, 126 172, 128 155Z"
          fill={figureAColor}
        />
        {/* Arm reaching toward B — hands meeting in middle */}
        <Path
          d="M145 82 C155 78, 168 75, 182 74 C190 73, 195 73, 200 74 L200 82 C195 81, 190 81, 182 82 C170 83, 158 86, 148 90Z"
          fill={figureAColor}
        />
      </G>

      {/* Figure B — standing, leaning back right */}
      <G id="figureB">
        <Circle cx="265" cy="52" r="16" fill={figureBColor} />
        {/* Torso — leaning back */}
        <Path
          d="M265 68 C272 72, 282 85, 288 105 C292 120, 292 138, 285 155 L260 155 C262 138, 262 120, 258 105 C255 90, 258 75, 265 68Z"
          fill={figureBColor}
        />
        {/* Left leg */}
        <Path
          d="M265 150 C264 168, 262 188, 260 210 C259 220, 258 230, 258 238 L272 240 C272 232, 272 222, 273 212 C274 192, 274 172, 272 155Z"
          fill={figureBColor}
        />
        {/* Right leg — planted */}
        <Path
          d="M285 150 C288 168, 292 188, 295 210 C296 220, 298 230, 300 238 L285 240 C284 232, 282 222, 282 212 C280 192, 278 172, 275 155Z"
          fill={figureBColor}
        />
        {/* Arm reaching toward A — hands meeting */}
        <Path
          d="M255 82 C245 78, 232 75, 218 74 C210 73, 205 73, 200 74 L200 82 C205 81, 210 81, 218 82 C230 83, 242 86, 252 90Z"
          fill={figureBColor}
        />
      </G>
    </Svg>
  );
}

/**
 * The Pulse — ip010
 * One flat on back, other lying on top chest to chest.
 * Abstract silhouette illustration.
 */
import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

export default function PulseIllustration({ width = '100%', height = 200, figureAColor = 'rgba(229,229,231,0.55)', figureBColor = '#D2121A' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 250">
      {/* Figure A — flat on back */}
      <G id="figureA">
        <Circle cx="105" cy="138" r="18" fill={figureAColor} />
        {/* Torso — flat horizontal */}
        <Path
          d="M122 132 C140 128, 165 128, 195 132 C220 135, 240 140, 252 145 L252 168 C240 164, 220 160, 195 158 C165 155, 140 155, 122 158Z"
          fill={figureAColor}
        />
        {/* Legs extended */}
        <Path
          d="M252 145 C265 142, 282 140, 300 140 C312 140, 322 142, 328 144 L328 155 C322 153, 312 152, 300 152 C282 153, 265 155, 252 158Z"
          fill={figureAColor}
        />
        {/* Arms at sides */}
        <Path
          d="M118 145 C112 155, 102 162, 90 166 C82 168, 75 168, 70 168 L72 160 C78 160, 85 160, 92 158 C102 154, 112 148, 118 140Z"
          fill={figureAColor}
        />
      </G>

      {/* Figure B — lying on top, chest to chest */}
      <G id="figureB">
        <Circle cx="130" cy="100" r="16" fill={figureBColor} />
        {/* Torso — on top of A, horizontal */}
        <Path
          d="M144 95 C158 92, 178 92, 200 98 C218 103, 232 110, 240 116 L236 135 C228 128, 215 120, 198 116 C178 110, 160 110, 145 112Z"
          fill={figureBColor}
        />
        {/* Upper leg */}
        <Path
          d="M236 122 C248 118, 262 116, 278 118 C290 120, 298 124, 305 128 L302 138 C296 134, 288 130, 278 128 C264 126, 250 128, 238 132Z"
          fill={figureBColor}
        />
        {/* Lower leg */}
        <Path
          d="M240 130 C252 134, 265 140, 278 148 C286 154, 292 158, 296 162 L288 168 C284 164, 278 158, 272 152 C260 144, 248 138, 238 135Z"
          fill={figureBColor}
        />
        {/* Arms alongside A */}
        <Path
          d="M140 105 C132 110, 122 115, 112 118 C105 120, 98 120, 94 118 L96 112 C100 114, 106 114, 114 112 C124 108, 134 104, 140 100Z"
          fill={figureBColor}
        />
      </G>
    </Svg>
  );
}

/**
 * The Slow Melt — ip002
 * Lying on sides facing each other, legs intertwined.
 * Abstract silhouette illustration.
 */
import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

export default function SlowMeltIllustration({ width = '100%', height = 200, figureAColor = 'rgba(229,229,231,0.55)', figureBColor = '#D2121A' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 250">
      {/* Figure A — lying on left side, facing right */}
      <G id="figureA">
        <Circle cx="95" cy="95" r="18" fill={figureAColor} />
        {/* Torso — horizontal on side */}
        <Path
          d="M110 88 C120 85, 135 90, 150 100 C165 110, 175 125, 178 140 C180 150, 175 158, 168 160 L140 158 C135 150, 130 140, 128 130 C126 118, 118 105, 110 95Z"
          fill={figureAColor}
        />
        {/* Upper leg */}
        <Path
          d="M168 155 C180 165, 195 180, 210 195 C218 203, 222 210, 220 215 L212 218 C210 212, 205 205, 198 198 C185 185, 172 170, 162 160Z"
          fill={figureAColor}
        />
        {/* Lower leg — extended back */}
        <Path
          d="M150 158 C140 168, 125 180, 110 190 C100 196, 90 200, 85 202 L88 210 C95 206, 108 198, 120 190 C138 178, 150 168, 155 160Z"
          fill={figureAColor}
        />
        {/* Arm reaching toward B */}
        <Path
          d="M135 95 C145 90, 160 88, 175 92 L174 100 C162 96, 148 97, 138 102Z"
          fill={figureAColor}
        />
      </G>

      {/* Figure B — lying on right side, facing left */}
      <G id="figureB">
        <Circle cx="285" cy="88" r="17" fill={figureBColor} />
        {/* Torso — horizontal on side */}
        <Path
          d="M270 82 C260 80, 245 85, 232 95 C218 106, 210 120, 208 135 C206 148, 210 155, 218 158 L245 156 C250 148, 253 138, 255 128 C257 115, 262 102, 270 92Z"
          fill={figureBColor}
        />
        {/* Upper leg — intertwined with A */}
        <Path
          d="M218 152 C205 162, 190 175, 178 188 C172 195, 168 202, 170 208 L178 212 C178 205, 182 198, 188 192 C200 180, 212 168, 222 158Z"
          fill={figureBColor}
        />
        {/* Lower leg */}
        <Path
          d="M238 156 C248 166, 262 178, 278 188 C288 194, 298 198, 305 200 L302 208 C294 204, 282 198, 270 190 C254 178, 242 168, 235 160Z"
          fill={figureBColor}
        />
        {/* Arm reaching toward A */}
        <Path
          d="M248 90 C238 86, 222 84, 208 88 L209 96 C220 92, 235 93, 245 98Z"
          fill={figureBColor}
        />
      </G>
    </Svg>
  );
}

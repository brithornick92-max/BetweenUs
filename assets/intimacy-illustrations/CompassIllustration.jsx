/**
 * The Compass — ip003
 * One lies back, other on top experimenting with angles/directions.
 * Abstract silhouette illustration.
 */
import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

export default function CompassIllustration({ width = '100%', height = 200, figureAColor = 'rgba(229,229,231,0.55)', figureBColor = '#D2121A' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 250">
      {/* Figure A — lying on back */}
      <G id="figureA">
        <Circle cx="120" cy="145" r="18" fill={figureAColor} />
        {/* Torso — flat on back */}
        <Path
          d="M138 142 C155 138, 180 135, 210 138 C235 140, 255 145, 265 150 L265 168 C255 165, 235 160, 210 158 C180 156, 155 158, 138 162Z"
          fill={figureAColor}
        />
        {/* Legs extended */}
        <Path
          d="M265 150 C280 148, 300 145, 320 142 C332 140, 340 138, 345 138 L345 148 C340 148, 332 150, 320 152 C300 155, 280 158, 265 160Z"
          fill={figureAColor}
        />
        {/* Arms relaxed at sides */}
        <Path
          d="M145 155 C140 168, 132 180, 120 188 L115 182 C125 175, 132 165, 138 155Z"
          fill={figureAColor}
        />
      </G>

      {/* Figure B — on top, angled/rotated */}
      <G id="figureB">
        <Circle cx="230" cy="80" r="16" fill={figureBColor} />
        {/* Torso — angled across A */}
        <Path
          d="M225 96 C218 100, 205 110, 195 122 C185 134, 180 145, 182 152 L200 155 C200 148, 205 138, 212 128 C220 118, 230 108, 235 100Z"
          fill={figureBColor}
        />
        {/* Left leg — extended to one side */}
        <Path
          d="M185 148 C175 158, 160 170, 145 178 C135 183, 125 186, 120 188 L124 196 C130 193, 142 188, 155 180 C170 172, 182 162, 190 152Z"
          fill={figureBColor}
        />
        {/* Right leg — other direction */}
        <Path
          d="M198 152 C210 160, 228 168, 248 172 C260 175, 270 176, 278 176 L276 184 C268 184, 258 182, 245 178 C225 174, 208 166, 195 158Z"
          fill={figureBColor}
        />
        {/* Arms bracing */}
        <Path
          d="M218 105 C210 100, 198 98, 188 102 L190 108 C198 105, 208 106, 215 110Z"
          fill={figureBColor}
        />
      </G>
    </Svg>
  );
}

/**
 * The Safe Harbor — ip004
 * One sits upright, other between their legs leaning back into them.
 * Abstract silhouette illustration.
 */
import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

export default function SafeHarborIllustration({ width = '100%', height = 200, figureAColor = 'rgba(229,229,231,0.55)', figureBColor = '#D2121A' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 250">
      {/* Figure A — sitting upright against headboard */}
      <G id="figureA">
        <Circle cx="185" cy="48" r="18" fill={figureAColor} />
        {/* Torso — upright */}
        <Path
          d="M185 66 C178 66, 168 80, 166 100 C164 120, 166 140, 170 160 L200 160 C204 140, 206 120, 204 100 C202 80, 192 66, 185 66Z"
          fill={figureAColor}
        />
        {/* Left leg — extended forward along floor */}
        <Path
          d="M170 155 C162 165, 148 178, 130 188 C118 195, 105 200, 95 202 L98 210 C108 207, 122 200, 138 192 C155 182, 168 170, 175 160Z"
          fill={figureAColor}
        />
        {/* Right leg — extended other side */}
        <Path
          d="M200 155 C208 165, 222 178, 240 188 C252 195, 265 200, 275 202 L272 210 C262 207, 248 200, 232 192 C215 182, 202 170, 195 160Z"
          fill={figureAColor}
        />
        {/* Arms wrapping around B */}
        <Path
          d="M170 90 C160 95, 155 108, 160 120 C165 130, 175 135, 185 132 L183 126 C176 128, 170 124, 167 116 C164 108, 166 100, 173 96Z"
          fill={figureAColor}
        />
        <Path
          d="M200 90 C210 95, 215 108, 210 120 C205 130, 195 135, 185 132 L187 126 C194 128, 200 124, 203 116 C206 108, 204 100, 197 96Z"
          fill={figureAColor}
        />
      </G>

      {/* Figure B — sitting between A's legs, leaning back */}
      <G id="figureB">
        <Circle cx="185" cy="72" r="15" fill={figureBColor} />
        {/* Torso — leaning back into A */}
        <Path
          d="M185 87 C180 87, 172 98, 170 115 C168 132, 170 148, 175 165 L195 165 C200 148, 202 132, 200 115 C198 98, 190 87, 185 87Z"
          fill={figureBColor}
        />
        {/* Legs — extended between A's legs */}
        <Path
          d="M175 160 C168 172, 155 185, 140 195 C130 200, 122 205, 118 208 L122 215 C128 211, 138 205, 150 198 C165 190, 175 178, 180 168Z"
          fill={figureBColor}
        />
        <Path
          d="M195 160 C202 172, 215 185, 230 195 C240 200, 248 205, 252 208 L248 215 C242 211, 232 205, 220 198 C205 190, 195 178, 190 168Z"
          fill={figureBColor}
        />
        {/* Arms resting on A's legs */}
        <Path
          d="M172 110 C162 115, 150 118, 140 116 L141 110 C150 112, 160 110, 168 106Z"
          fill={figureBColor}
        />
        <Path
          d="M198 110 C208 115, 220 118, 230 116 L229 110 C220 112, 210 110, 202 106Z"
          fill={figureBColor}
        />
      </G>
    </Svg>
  );
}

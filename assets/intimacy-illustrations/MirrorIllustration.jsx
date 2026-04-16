/**
 * The Mirror — ip007
 * Both kneeling face to face, mirroring each other's movements.
 * Abstract silhouette illustration.
 */
import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

export default function MirrorIllustration({ width = '100%', height = 200, figureAColor = 'rgba(229,229,231,0.55)', figureBColor = '#D2121A' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 250">
      {/* Figure A — kneeling, left side */}
      <G id="figureA">
        <Circle cx="150" cy="50" r="17" fill={figureAColor} />
        {/* Torso — upright kneeling */}
        <Path
          d="M150 67 C143 70, 136 82, 134 100 C132 118, 135 135, 140 150 L160 150 C165 135, 168 118, 166 100 C164 82, 157 70, 150 67Z"
          fill={figureAColor}
        />
        {/* Kneeling legs — folded underneath */}
        <Path
          d="M140 148 C135 160, 128 172, 120 180 C115 185, 112 192, 115 200 C118 208, 128 210, 138 208 C148 205, 152 195, 150 185 C148 178, 145 168, 148 155Z"
          fill={figureAColor}
        />
        <Path
          d="M160 148 C162 160, 165 172, 168 180 C170 188, 168 195, 162 200 C156 205, 148 206, 142 202 L148 195 C152 198, 158 196, 160 192 C162 186, 160 178, 158 168 C156 160, 155 152, 155 148Z"
          fill={figureAColor}
        />
        {/* Right arm — raised, mirroring */}
        <Path
          d="M162 82 C170 75, 178 68, 185 62 C190 58, 192 55, 192 52 L185 50 C185 54, 182 58, 178 62 C172 68, 166 74, 160 80Z"
          fill={figureAColor}
        />
        {/* Left arm — extended */}
        <Path
          d="M138 85 C130 80, 122 76, 115 74 C110 72, 105 72, 102 74 L104 80 C108 78, 112 78, 118 80 C125 82, 132 86, 140 90Z"
          fill={figureAColor}
        />
      </G>

      {/* Figure B — kneeling, right side, mirror pose */}
      <G id="figureB">
        <Circle cx="250" cy="50" r="16" fill={figureBColor} />
        {/* Torso — upright kneeling */}
        <Path
          d="M250 66 C257 70, 264 82, 266 100 C268 118, 265 135, 260 150 L240 150 C235 135, 232 118, 234 100 C236 82, 243 70, 250 66Z"
          fill={figureBColor}
        />
        {/* Kneeling legs */}
        <Path
          d="M260 148 C265 160, 272 172, 280 180 C285 185, 288 192, 285 200 C282 208, 272 210, 262 208 C252 205, 248 195, 250 185 C252 178, 255 168, 252 155Z"
          fill={figureBColor}
        />
        <Path
          d="M240 148 C238 160, 235 172, 232 180 C230 188, 232 195, 238 200 C244 205, 252 206, 258 202 L252 195 C248 198, 242 196, 240 192 C238 186, 240 178, 242 168 C244 160, 245 152, 245 148Z"
          fill={figureBColor}
        />
        {/* Left arm — raised, mirroring A */}
        <Path
          d="M238 82 C230 75, 222 68, 215 62 C210 58, 208 55, 208 52 L215 50 C215 54, 218 58, 222 62 C228 68, 234 74, 240 80Z"
          fill={figureBColor}
        />
        {/* Right arm — extended */}
        <Path
          d="M262 85 C270 80, 278 76, 285 74 C290 72, 295 72, 298 74 L296 80 C292 78, 288 78, 282 80 C275 82, 268 86, 260 90Z"
          fill={figureBColor}
        />
      </G>
    </Svg>
  );
}

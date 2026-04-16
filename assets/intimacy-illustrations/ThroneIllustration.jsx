/**
 * The Throne — ip008
 * One seated on edge, other kneeling in front.
 * Abstract silhouette illustration.
 */
import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

export default function ThroneIllustration({ width = '100%', height = 200, figureAColor = 'rgba(229,229,231,0.55)', figureBColor = '#D2121A' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 250">
      {/* Figure A — seated on edge of surface */}
      <G id="figureA">
        <Circle cx="175" cy="42" r="18" fill={figureAColor} />
        {/* Torso — upright seated */}
        <Path
          d="M175 60 C168 62, 160 75, 158 95 C156 112, 158 128, 162 140 L188 140 C192 128, 194 112, 192 95 C190 75, 182 62, 175 60Z"
          fill={figureAColor}
        />
        {/* Left leg — hanging from edge, bent at knee */}
        <Path
          d="M162 138 C158 150, 152 165, 148 180 C145 190, 142 198, 140 205 L155 208 C156 200, 158 192, 160 182 C163 168, 166 155, 168 145Z"
          fill={figureAColor}
        />
        {/* Right leg — hanging */}
        <Path
          d="M188 138 C192 150, 198 165, 202 180 C205 190, 208 198, 210 205 L195 208 C194 200, 192 192, 190 182 C187 168, 184 155, 182 145Z"
          fill={figureAColor}
        />
        {/* Surface / seat edge */}
        <Path
          d="M130 140 L220 140 L220 148 L130 148Z"
          fill={figureAColor}
          opacity={0.3}
        />
        {/* Arms at sides / on B */}
        <Path
          d="M162 80 C155 85, 150 92, 150 100 L156 102 C156 94, 160 88, 165 84Z"
          fill={figureAColor}
        />
        <Path
          d="M188 80 C195 85, 200 92, 200 100 L194 102 C194 94, 190 88, 185 84Z"
          fill={figureAColor}
        />
      </G>

      {/* Figure B — kneeling on floor in front */}
      <G id="figureB">
        <Circle cx="175" cy="108" r="15" fill={figureBColor} />
        {/* Torso — upright kneeling */}
        <Path
          d="M175 123 C170 125, 164 135, 162 150 C160 162, 162 172, 166 182 L184 182 C188 172, 190 162, 188 150 C186 135, 180 125, 175 123Z"
          fill={figureBColor}
        />
        {/* Kneeling legs — folded under */}
        <Path
          d="M166 178 C160 188, 152 198, 148 208 C145 215, 148 222, 155 225 C162 228, 170 224, 172 218 C174 212, 170 202, 168 192 L170 182Z"
          fill={figureBColor}
        />
        <Path
          d="M184 178 C190 188, 198 198, 202 208 C205 215, 202 222, 195 225 C188 228, 180 224, 178 218 C176 212, 180 202, 182 192 L180 182Z"
          fill={figureBColor}
        />
        {/* Hands resting on A's thighs */}
        <Path
          d="M165 138 C158 142, 152 145, 148 145 L149 140 C153 140, 158 138, 164 134Z"
          fill={figureBColor}
        />
        <Path
          d="M185 138 C192 142, 198 145, 202 145 L201 140 C197 140, 192 138, 186 134Z"
          fill={figureBColor}
        />
      </G>
    </Svg>
  );
}

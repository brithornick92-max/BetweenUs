/**
 * The Drift — ip009
 * Lying tangled together loosely, moving only when the body wants to.
 * Abstract silhouette illustration.
 */
import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

export default function DriftIllustration({ width = '100%', height = 200, figureAColor = 'rgba(229,229,231,0.55)', figureBColor = '#D2121A' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 250">
      {/* Figure A — lying relaxed, slightly angled */}
      <G id="figureA">
        <Circle cx="100" cy="108" r="17" fill={figureAColor} />
        {/* Torso — relaxed horizontal */}
        <Path
          d="M115 102 C130 98, 150 100, 172 108 C190 115, 205 125, 212 132 L208 150 C200 142, 185 132, 168 126 C148 118, 128 116, 115 118Z"
          fill={figureAColor}
        />
        {/* Upper leg — loosely bent */}
        <Path
          d="M208 140 C218 148, 228 160, 238 175 C244 185, 248 192, 250 198 L240 202 C238 196, 234 188, 228 178 C220 165, 212 155, 205 148Z"
          fill={figureAColor}
        />
        {/* Lower leg — trailing */}
        <Path
          d="M198 148 C192 160, 182 172, 170 182 C162 188, 155 192, 148 195 L152 203 C160 198, 170 192, 180 185 C192 175, 200 164, 205 152Z"
          fill={figureAColor}
        />
        {/* Arm draped over B */}
        <Path
          d="M130 105 C140 100, 155 98, 170 100 L169 108 C156 106, 142 108, 132 112Z"
          fill={figureAColor}
        />
      </G>

      {/* Figure B — tangled with A, different angle */}
      <G id="figureB">
        <Circle cx="195" cy="95" r="16" fill={figureBColor} />
        {/* Torso — across A */}
        <Path
          d="M188 110 C182 115, 172 128, 168 145 C165 158, 168 168, 175 175 L195 175 C198 168, 200 158, 198 145 C196 130, 192 118, 192 110Z"
          fill={figureBColor}
        />
        {/* Upper leg — intertwined with A */}
        <Path
          d="M190 172 C200 180, 215 190, 230 196 C240 200, 252 202, 260 202 L258 210 C250 210, 238 208, 225 202 C210 195, 198 186, 188 178Z"
          fill={figureBColor}
        />
        {/* Lower leg */}
        <Path
          d="M178 172 C170 182, 158 192, 145 198 C135 203, 128 205, 122 206 L125 214 C132 212, 142 208, 155 202 C170 194, 180 185, 185 178Z"
          fill={figureBColor}
        />
        {/* Arm on A */}
        <Path
          d="M185 115 C175 112, 162 108, 150 110 L151 118 C162 116, 174 118, 183 120Z"
          fill={figureBColor}
        />
      </G>
    </Svg>
  );
}

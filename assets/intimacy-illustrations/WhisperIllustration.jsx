/**
 * The Whisper — ip006
 * Spooning on sides, mouth near neck.
 * Abstract silhouette illustration.
 */
import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

export default function WhisperIllustration({ width = '100%', height = 200, figureAColor = 'rgba(229,229,231,0.55)', figureBColor = '#D2121A' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 250">
      {/* Figure A — front spoon, lying on side */}
      <G id="figureA">
        <Circle cx="160" cy="100" r="16" fill={figureAColor} />
        {/* Torso — curved on side */}
        <Path
          d="M170 108 C178 112, 188 125, 192 142 C195 155, 192 168, 185 178 L165 178 C162 168, 160 155, 162 142 C164 128, 168 115, 170 108Z"
          fill={figureAColor}
        />
        {/* Upper leg — bent forward */}
        <Path
          d="M175 175 C168 188, 155 200, 138 208 C128 213, 118 215, 110 216 L113 224 C122 222, 134 218, 148 212 C165 204, 178 192, 182 180Z"
          fill={figureAColor}
        />
        {/* Lower leg */}
        <Path
          d="M168 175 C162 188, 155 200, 148 210 C142 218, 135 222, 130 225 L136 232 C142 228, 150 222, 158 214 C166 205, 172 192, 175 180Z"
          fill={figureAColor}
        />
        {/* Arm tucked */}
        <Path
          d="M165 120 C155 125, 145 128, 138 126 L139 120 C145 122, 153 120, 162 116Z"
          fill={figureAColor}
        />
      </G>

      {/* Figure B — big spoon behind A */}
      <G id="figureB">
        <Circle cx="215" cy="92" r="17" fill={figureBColor} />
        {/* Torso — curved behind A, close */}
        <Path
          d="M208 108 C200 112, 195 128, 198 148 C200 162, 205 172, 212 180 L232 180 C235 172, 238 162, 236 148 C234 128, 225 112, 218 108Z"
          fill={figureBColor}
        />
        {/* Upper leg — following A's curve */}
        <Path
          d="M225 175 C218 188, 205 200, 190 210 C180 216, 170 220, 162 222 L165 230 C174 227, 186 222, 200 214 C218 205, 230 192, 235 180Z"
          fill={figureBColor}
        />
        {/* Lower leg */}
        <Path
          d="M215 175 C210 190, 208 205, 210 218 C212 225, 215 232, 218 236 L228 234 C225 228, 222 222, 220 215 C218 205, 218 192, 222 178Z"
          fill={figureBColor}
        />
        {/* Arm draped over A */}
        <Path
          d="M205 115 C195 118, 182 122, 170 125 C160 128, 152 130, 148 130 L150 138 C155 137, 164 134, 175 130 C188 126, 200 122, 208 120Z"
          fill={figureBColor}
        />
      </G>
    </Svg>
  );
}

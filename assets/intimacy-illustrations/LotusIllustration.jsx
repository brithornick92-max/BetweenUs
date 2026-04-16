/**
 * The Lotus — ip001
 * Couple seated face to face, her in his lap, legs wrapped around,
 * arms embracing. Silhouette style matching reference art.
 */
import React from 'react';
import Svg, { Path, G } from 'react-native-svg';

export default function LotusIllustration({ width = '100%', height = 200, figureAColor = 'rgba(229,229,231,0.55)', figureBColor = '#D2121A' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 420 300">
      {/* Figure A — him, seated, legs out front, arms around her back */}
      <G id="figureA">
        {/* Head — slightly turned toward her, short hair */}
        <Path
          d="M248 52 C248 38, 238 28, 225 28 C212 28, 204 38, 204 52 C204 60, 208 67, 214 71 C210 73, 208 76, 210 78 L218 80 C222 76, 228 74, 234 76 L240 78 C242 76, 240 73, 236 71 C242 67, 248 60, 248 52Z"
          fill={figureAColor}
        />
        {/* Neck */}
        <Path
          d="M218 78 C220 84, 222 90, 220 94 L232 94 C230 90, 230 84, 234 78Z"
          fill={figureAColor}
        />
        {/* Torso — broad, seated upright, slight lean forward */}
        <Path
          d="M208 94 C200 96, 192 102, 190 112 C188 125, 190 142, 194 158 C196 168, 200 178, 205 186 L245 186 C248 178, 252 168, 254 158 C258 142, 258 125, 254 112 C250 102, 244 96, 238 94Z"
          fill={figureAColor}
        />
        {/* Right arm — wrapping around her back/waist */}
        <Path
          d="M208 108 C200 112, 192 118, 186 126 C180 134, 176 142, 174 148 C172 154, 170 160, 172 164 L180 166 C180 160, 182 154, 186 148 C190 140, 194 134, 198 128 C200 124, 196 120, 190 118"
          fill={figureAColor}
        />
        {/* Left arm — around her upper back/shoulder */}
        <Path
          d="M244 106 C250 110, 256 116, 258 124 C260 130, 258 136, 254 140 L248 136 C252 132, 252 126, 250 122 C248 116, 244 112, 240 110Z"
          fill={figureAColor}
        />
        {/* Right leg — extended forward, slightly bent at knee */}
        <Path
          d="M205 182 C198 192, 188 205, 175 218 C165 228, 152 238, 140 245 C132 250, 122 254, 112 256 L108 264 C100 268, 92 270, 86 270 L86 278 C95 278, 106 274, 116 268 L120 262 C132 256, 148 246, 164 234 C180 220, 194 206, 208 192Z"
          fill={figureAColor}
        />
        {/* Left leg — bent underneath, knee up */}
        <Path
          d="M240 182 C248 192, 258 204, 268 218 C275 228, 284 240, 290 248 C295 254, 300 260, 308 264 L316 260 C308 254, 300 246, 294 238 C286 226, 276 212, 266 200 C258 192, 250 186, 245 184Z"
          fill={figureAColor}
        />
        {/* Left foot area */}
        <Path
          d="M308 264 C314 268, 322 270, 330 270 L332 262 C324 264, 316 262, 310 258Z"
          fill={figureAColor}
        />
      </G>

      {/* Figure B — her, in his lap facing him, legs wrapped around */}
      <G id="figureB">
        {/* Head — facing him, hair detail */}
        <Path
          d="M200 44 C200 30, 190 20, 178 20 C166 20, 156 30, 156 44 C156 50, 158 56, 162 60 C156 58, 150 54, 148 50 C146 54, 148 62, 154 66 C158 68, 162 70, 166 72 L168 78 C172 76, 178 74, 184 76 L186 78 C190 72, 196 66, 200 60 C200 56, 200 50, 200 44Z"
          fill={figureBColor}
        />
        {/* Neck */}
        <Path
          d="M170 76 C172 82, 174 88, 172 92 L184 92 C182 88, 182 82, 186 76Z"
          fill={figureBColor}
        />
        {/* Torso — slimmer, leaning into him */}
        <Path
          d="M162 92 C156 95, 150 102, 150 114 C150 128, 154 144, 160 158 C164 168, 168 176, 174 184 L208 184 C212 176, 214 168, 216 158 C220 144, 220 128, 216 114 C212 102, 206 95, 198 92Z"
          fill={figureBColor}
        />
        {/* Left arm — over his right shoulder, hand on his back */}
        <Path
          d="M196 102 C204 98, 214 96, 222 98 C230 100, 236 104, 240 110 C244 116, 246 122, 244 126 L238 124 C238 120, 236 114, 232 110 C228 106, 222 104, 216 104 C210 104, 204 106, 200 108Z"
          fill={figureBColor}
        />
        {/* Right arm — around his neck/shoulder */}
        <Path
          d="M164 104 C158 108, 152 114, 150 122 C148 128, 150 132, 154 134 L160 130 C158 128, 158 124, 160 120 C162 114, 166 110, 170 108Z"
          fill={figureBColor}
        />
        {/* Right leg — wrapped around his left side, knee bent */}
        <Path
          d="M200 178 C210 186, 222 196, 234 208 C242 218, 250 228, 256 238 C260 245, 262 252, 260 258 L252 260 C252 254, 250 248, 246 240 C240 230, 232 220, 222 210 C214 202, 206 194, 200 188Z"
          fill={figureBColor}
        />
        {/* Left leg — extended, intertwined, crossing under his leg */}
        <Path
          d="M170 180 C162 190, 150 204, 138 216 C128 226, 118 234, 108 240 C100 244, 92 248, 84 250 L80 256 C72 260, 64 262, 56 262 L56 270 C66 270, 78 266, 88 260 L92 254 C102 248, 116 240, 130 228 C146 214, 160 200, 172 190Z"
          fill={figureBColor}
        />
        {/* Left foot */}
        <Path
          d="M56 262 C50 264, 44 264, 40 262 L38 270 C44 272, 52 272, 58 270Z"
          fill={figureBColor}
        />
      </G>
    </Svg>
  );
}

/**
 * Intimacy Position Illustrations — Index
 * Prefers staged PNG assets when available, falls back to SVG components.
 */

import LotusIllustration from './LotusIllustration';
import SlowMeltIllustration from './SlowMeltIllustration';
import CompassIllustration from './CompassIllustration';
import SafeHarborIllustration from './SafeHarborIllustration';
import BridgeIllustration from './BridgeIllustration';
import WhisperIllustration from './WhisperIllustration';
import MirrorIllustration from './MirrorIllustration';
import ThroneIllustration from './ThroneIllustration';
import DriftIllustration from './DriftIllustration';
import PulseIllustration from './PulseIllustration';

// Staged PNG illustrations — preferred over SVG where available
const imageIllustrations = {
  ip001: require('./images/lotus.png'),
  ip004: require('./images/harbor.png'),
  ip005: require('./images/bridge.png'),
  ip007: require('./images/mirror.png'),
  ip008: require('./images/throne.png'),
  ip010: require('./images/pulse.png'),
};

const variantImageIllustrations = {
  ip003: {
    'her-her': require('./images/overlap.png'),
    'him-him': require('./images/overlap.png'),
  },
  ip004: {
    'her-her': require('./images/harbor-alt.png'),
    'him-him': require('./images/harbor-alt.png'),
  },
  ip008: {
    'her-her': require('./images/throne-alt.png'),
    'him-him': require('./images/throne-alt.png'),
  },
  ip010: {
    'her-her': require('./images/pulse-alt.png'),
    'him-him': require('./images/pulse-alt.png'),
  },
};

// SVG fallback components for positions not yet covered by PNGs
const svgIllustrations = {
  ip001: LotusIllustration,
  ip002: SlowMeltIllustration,
  ip003: CompassIllustration,
  ip004: SafeHarborIllustration,
  ip005: BridgeIllustration,
  ip006: WhisperIllustration,
  ip007: MirrorIllustration,
  ip008: ThroneIllustration,
  ip009: DriftIllustration,
  ip010: PulseIllustration,
};

/**
 * Returns a PNG source (number) when available, otherwise an SVG component.
 */
export function getIllustration(positionId) {
  return imageIllustrations[positionId] || svgIllustrations[positionId] || null;
}

/**
 * Variant/body-type aware lookup — same preference order.
 */
export function getIllustrationForBodyType(positionId, variant, bodyType) {
  const variantIllustration = variantImageIllustrations[positionId]?.[variant];
  return variantIllustration || imageIllustrations[positionId] || svgIllustrations[positionId] || null;
}

export default { ...svgIllustrations, ...imageIllustrations };

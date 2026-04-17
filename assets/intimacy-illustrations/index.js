/**
 * Intimacy Position Illustrations — Index
 * 17 PNG assets numbered 1–17.
 *
 * Mapping:
 *  1  anchor (ip012)        10 pulse-alt (ip010 variant)
 *  2  bridge (ip005)        11 pulse-close (ip010 alt)
 *  3  constellation (ip013) 12 pulse (ip010)
 *  4  gravity-well (ip014)  13 reveal-standing (ip011)
 *  5  harbor-alt (ip004 v)  14 throne-alt-2 (ip008 alt)
 *  6  harbor (ip004)        15 throne-alt (ip008 variant)
 *  7  lotus (ip001)         16 throne (ip008)
 *  8  mirror (ip007)        17 wheelbarrow (ip017)
 *  9  overlap (ip003 v)
 */

// Primary illustration per position
const illustrations = {
  ip001: require('./7.png'),   // lotus
  ip003: require('./9.png'),   // overlap / compass
  ip004: require('./6.png'),   // harbor
  ip005: require('./2.png'),   // bridge
  ip007: require('./8.png'),   // mirror
  ip008: require('./16.png'),  // throne
  ip010: require('./12.png'),  // pulse
  ip011: require('./13.png'),  // reveal-standing
  ip012: require('./1.png'),   // anchor
  ip013: require('./3.png'),   // constellation-butterfly
  ip014: require('./4.png'),   // gravity-well
  ip017: require('./17.png'),  // wheelbarrow / pendulum
};

const variantIllustrations = {
  ip004: {
    'her-her': require('./5.png'),   // harbor-alt
    'him-him': require('./5.png'),
  },
  ip008: {
    'her-her': require('./15.png'),  // throne-alt
    'him-him': require('./15.png'),
  },
  ip010: {
    'her-her': require('./10.png'),  // pulse-alt
    'him-him': require('./10.png'),
  },
};

// Additional assets available but not primary:
// 11.png  pulse-close (alternate angle for ip010)
// 14.png  throne-alt-2 (second alternate for ip008)

/**
 * Returns a PNG source for a given position ID.
 */
export function getIllustration(positionId) {
  return illustrations[positionId] || null;
}

/**
 * Variant-aware lookup.
 */
export function getIllustrationForBodyType(positionId, variant) {
  const variantIllustration = variantIllustrations[positionId]?.[variant];
  return variantIllustration || illustrations[positionId] || null;
}

export default illustrations;

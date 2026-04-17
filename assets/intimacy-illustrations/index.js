/**
 * Intimacy Position Illustrations — Index
 * 17 PNG assets numbered 1–17, mapped 1:1 to position IDs ip001–ip017.
 *
 *  1  → ip012  elevated leg rear entry
 *  2  → ip005  bridge arch
 *  3  → ip013  butterfly / bed-edge
 *  4  → ip014  standing carry face-to-face
 *  5  → ip004  classic doggy
 *  6  → ip015  forearm / deep prone
 *  7  → ip001  lotus seated
 *  8  → ip016  semi-reclined from behind
 *  9  → ip002  seated spooning from behind
 * 10  → ip007  stacked kneeling (both on all fours)
 * 11  → ip009  lying flat together from behind
 * 12  → ip010  missionary
 * 13  → ip011  standing carry tight-wrap
 * 14  → ip003  reverse cowgirl upright
 * 15  → ip008  cowgirl upright
 * 16  → ip006  leaning-back reverse cowgirl
 * 17  → ip017  wheelbarrow / bent far forward
 */

const illustrations = {
  ip001: require('./7.png'),
  ip002: require('./9.png'),
  ip003: require('./14.png'),
  ip004: require('./5.png'),
  ip005: require('./2.png'),
  ip006: require('./16.png'),
  ip007: require('./10.png'),
  ip008: require('./15.png'),
  ip009: require('./11.png'),
  ip010: require('./12.png'),
  ip011: require('./13.png'),
  ip012: require('./1.png'),
  ip013: require('./3.png'),
  ip014: require('./4.png'),
  ip015: require('./6.png'),
  ip016: require('./8.png'),
  ip017: require('./17.png'),
};

/**
 * Returns a PNG require() source for a given position ID, or null.
 */
export function getIllustration(positionId) {
  return illustrations[positionId] || null;
}

/**
 * Variant-aware lookup — all positions currently use the same illustration
 * regardless of couple variant.
 */
export function getIllustrationForBodyType(positionId, variant) {
  return illustrations[positionId] || null;
}

export default illustrations;

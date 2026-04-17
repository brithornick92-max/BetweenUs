/**
 * Intimacy Position Illustrations — Index
 * SVG assets with red + gray themed figures and white outlines.
 *
 *  1  → ip007  stacked (kneeling lunge)
 *  2  → ip011  standing carry
 *  3  → ip001  seated reverse arch
 *  4  → ip003  reverse cowgirl
 *  5  → ip005  bridge
 *  6  → ip019  seated side lean
 *  7  → ip002  seated arch
 *  8  → ip013  butterfly / bed-edge
 *  9  → ip009  69
 * 10  → ip012  elevated leg
 * 11  → ip004  doggy style (standing)
 * 12  → ip010  missionary
 * 13  → ip014  standing wrap
 * 14  → ip015  wheelbarrow
 * 15  → ip008  cowgirl
 * 16  → ip006  arc / forward lean
 * 18  → ip018  side straddle
 * 19  → ip016  reclined spoon
 * (17 removed — duplicate of 18)
 */

const illustrations = {
  ip001: require('./png/7.png'),   // Seated Reverse Arch
  ip002: require('./png/3.png'),   // Seated Arch
  ip003: require('./png/4.png'),   // Reverse Cowgirl
  ip004: require('./png/11.png'),  // Doggy Style (standing)
  ip005: require('./png/5.png'),   // Bridge
  ip006: require('./png/16.png'),  // Arc / Forward Lean
  ip007: require('./png/1.png'),   // Stacked (kneeling lunge)
  ip008: require('./png/15.png'),  // Cowgirl
  ip009: require('./png/9.png'),   // 69
  ip010: require('./png/12.png'),  // Missionary
  ip011: require('./png/2.png'),   // Standing Carry
  ip012: require('./png/10.png'),  // Elevated Leg
  ip013: require('./png/8.png'),   // Butterfly
  ip014: require('./png/13.png'),  // Standing Wrap
  ip015: require('./png/14.png'),  // Wheelbarrow
  ip016: require('./png/19.png'),  // Reclined Spoon
  ip018: require('./png/18.png'),  // Side Straddle
  ip019: require('./png/6.png'),   // Seated Side Lean
};

/**
 * Returns an image asset (number) for a given position ID, or null.
 */
export function getIllustration(positionId) {
  return illustrations[positionId] || null;
}

/**
 * Variant-aware lookup — returns the same asset regardless of couple variant.
 */
export function getIllustrationForBodyType(positionId, variant) {
  return illustrations[positionId] || null;
}

export default illustrations;

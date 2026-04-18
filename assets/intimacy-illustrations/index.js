/**
 * Intimacy Position Illustrations — Index
 * SVG assets with red + gray themed figures and white outlines.
 *
 *  1  → ip007  overhang (kneeling lunge)
 *  2  → ip011  the ascent (standing carry)
 *  3  → ip002  the mirror (seated face-to-face)
 *  4  → ip003  the descent (supported straddle)
 *  5  → ip005  the reflection (mirrored reclined)
 *  6  → ip019  the conversation (reclined open)
 *  7  → ip001  the tether (seated lap straddle)
 *  8  → ip013  the lift (edge seated standing)
 *  9  → ip009  69
 * 10  → ip012  the arch (high open supported)
 * 11  → ip004  the summit (doggy style kneeling)
 * 12  → ip010  the solstice (legs on shoulders)
 * 13  → ip014  the pillar (standing wrap)
 * 14  → ip015  the bridge (backbend variation)
 * 15  → ip008  the reign (cowgirl)
 * 16  → ip006  the horizon (reverse cowgirl)
 * 17  → ip018  the press (lying-down rear-entry variation)
 * 18  → ip016  the devotion (lying oral)
 */

const illustrations = {
  ip001: require('./png/7.png'),   // The Tether (seated lap straddle)
  ip002: require('./png/3.png'),   // The Mirror (seated face-to-face)
  ip003: require('./png/4.png'),   // The Descent (supported straddle)
  ip004: require('./png/11.png'),  // The Summit (doggy style)
  ip005: require('./png/5.png'),   // The Reflection (mirrored reclined)
  ip006: require('./png/16.png'),  // The Horizon (reverse cowgirl)
  ip007: require('./png/1.png'),   // Overhang (kneeling lunge)
  ip008: require('./png/15.png'),  // The Reign (cowgirl)
  ip009: require('./png/9.png'),   // 69
  ip010: require('./png/12.png'),  // The Solstice (legs on shoulders)
  ip011: require('./png/2.png'),   // The Ascent (standing carry)
  ip012: require('./png/10.png'),  // The Arch (high open supported)
  ip013: require('./png/8.png'),   // The Lift (edge seated standing)
  ip014: require('./png/13.png'),  // The Pillar (standing wrap)
  ip015: require('./png/14.png'),  // The Bridge (backbend variation)
  ip016: require('./png/18.png'),  // The Devotion (lying oral)
  ip018: require('./png/17.png'),  // The Press (lying-down rear-entry variation)
  ip019: require('./png/6.png'),   // The Conversation (reclined open)
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

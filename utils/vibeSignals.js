export const VIBE_SIGNALS = [
  { id: 'passionate', name: 'Passionate', icon: 'flame-outline', color: '#D2121A', emoji: '🔥' },
  { id: 'tender', name: 'Tender', icon: 'heart-outline', color: '#FF6B98', emoji: '💗' },
  { id: 'serene', name: 'Serene', icon: 'leaf-outline', color: '#32ADE6', emoji: '🍃' },
  { id: 'adventurous', name: 'Playful', icon: 'sparkles-outline', color: '#FF9500', emoji: '✨' },
  { id: 'mysterious', name: 'Mysterious', icon: 'moon-outline', color: '#AF52DE', emoji: '🌙' },
  { id: 'luxurious', name: 'Grounded', icon: 'infinite-outline', color: '#34C759', emoji: '♾️' },
];

export const DEFAULT_VIBE_SIGNAL = VIBE_SIGNALS[0];

export function getVibeSignalById(id) {
  return VIBE_SIGNALS.find((vibe) => vibe.id === id) || DEFAULT_VIBE_SIGNAL;
}

export function normalizeVibeSignal(vibe) {
  const resolved = getVibeSignalById(vibe?.id);

  return {
    id: resolved.id,
    name: vibe?.name || resolved.name,
    label: (vibe?.label || vibe?.name || resolved.name).toLowerCase(),
    icon: vibe?.icon || resolved.icon,
    color: vibe?.color || resolved.color,
    emoji: vibe?.emoji || resolved.emoji,
  };
}

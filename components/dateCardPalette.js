export const DATE_CARD_PALETTES = {
  1: {
    base: '#050608',
    mid: '#111418',
    chrome: '#B9BEC6',
    highlight: '#F5F3EE',
    text: '#F4F1EB',
    body: '#C5C0B8',
    band: ['#181B20', '#08090C'],
    tagBackground: 'rgba(255,255,255,0.06)',
    badgeBackground: 'rgba(255,255,255,0.05)',
    frameFill: 'rgba(255,255,255,0.025)',
    shadow: 'rgba(0,0,0,0.34)',
  },
  2: {
    base: '#171A1F',
    mid: '#2B3036',
    chrome: '#C6CCD4',
    highlight: '#FAF8F3',
    text: '#F3F0E9',
    body: '#D2CDC5',
    band: ['#333941', '#1B1F25'],
    tagBackground: 'rgba(255,255,255,0.07)',
    badgeBackground: 'rgba(255,255,255,0.06)',
    frameFill: 'rgba(255,255,255,0.03)',
    shadow: 'rgba(0,0,0,0.28)',
  },
  3: {
    base: '#2A060A',
    mid: '#4B0B12',
    chrome: '#E8D9D2',
    highlight: '#FFF6F1',
    text: '#FFF3EE',
    body: '#E6C8C0',
    band: ['#6A1018', '#32070B'],
    tagBackground: 'rgba(255,255,255,0.07)',
    badgeBackground: 'rgba(0,0,0,0.2)',
    frameFill: 'rgba(255,255,255,0.028)',
    shadow: 'rgba(28,0,0,0.34)',
  },
};

export function getDateCardPalette(heat = 1) {
  return DATE_CARD_PALETTES[heat] || DATE_CARD_PALETTES[1];
}
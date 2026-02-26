const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./content/prompts.json', 'utf8'));

const newPrompts = [
  {
    id: 'h5_155',
    text: "We're deep in the woods at our campsite, miles from anyone. The fire's dying down, the sleeping bag is unzipped, and the night air is cool against our skin. Describe how the isolation changes everything — the sounds we make knowing nobody can hear, how the firelight plays across our bodies, every bold thing you'd do knowing the nearest person is miles away...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_156',
    text: "We're swimming together in a secluded mountain lake at sunset. The water is warm on the surface, cool underneath, and we're completely alone. Describe how it starts — the way our bodies feel weightless together, how hands move differently underwater, pulling me close with nothing between us, the sensation of skin against skin in the water as the sun disappears...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_157',
    text: "We're alone in an outdoor hot tub under the stars, the jets pulsing around us, steam rising into the cold night air. Describe every detail — how you position us so the jets hit just right, the way the bubbling water hides what your hands are doing underneath, how the heat of the water mixes with the heat between us as things escalate...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_158',
    text: "We've been flirting with someone we both find irresistible. Tonight, they're in our bedroom. Describe the scene from the very beginning — who makes the first move, how the three of us navigate each other's bodies, the dynamic of watching me with someone else while waiting for your turn, every position, every moment of shared pleasure...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_159',
    text: "I'm your therapist. You've been coming to sessions for weeks, and the tension has been building. Today I close my notebook, lock the office door, and tell you I've been thinking about you non-stop. My partner is waiting in the next room — I invited them because I want us all together. Describe what happens when that door opens, the power dynamic, every detail of how the session turns into something none of us will forget...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_160',
    text: "You're a flight attendant on a private jet and I'm your only passenger. After takeoff, you close the cabin curtain and tell me this flight comes with very special first-class service. Describe the full fantasy — the uniform coming undone, the turbulence that pushes us together, every mile-high detail from takeoff to the descent you give me...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_161',
    text: "We're strangers who locked eyes across a hotel bar. No names, no history — just raw attraction. You slide into the seat next to me and within minutes we're in the elevator, barely keeping our hands off each other. Describe every moment from the hallway to the hotel room — the urgency, the anonymity, the things we do because there are no strings and no rules...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_162',
    text: "I'm your personal yoga instructor. We're alone in a candlelit studio for a private evening session. As I guide you into each pose, my hands linger longer than they should — adjusting your hips, pressing against your back. Describe how the stretching turns into something else entirely, the flexibility, the positions that transition from yoga to pure desire...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_163',
    text: "We rented a cabin with a massive window overlooking a valley — no neighbors, no curtains, nothing but wilderness. There's a bearskin rug by the fireplace and a storm rolling in. Describe the entire night — how the thunder covers our sounds, the warmth of the fire on bare skin, every position we try in front of that window knowing nature is our only audience...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_164',
    text: "You're a photographer and I'm your model for a provocative private shoot. It starts tasteful — artistic poses, dramatic lighting. But with each shot, you direct me to remove another layer, and the camera eventually gets set aside. Describe the full arc — the tension of being watched through a lens, when you finally put the camera down and cross the line from artist to lover...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_165',
    text: "We're at a masquerade party in a mansion. Masks on, identities hidden. We find a locked room upstairs — velvet furniture, dim lighting, a mirror covering one wall. We can hear the party below but no one knows we've slipped away. Describe what happens behind that locked door, with the masks still on, the anonymity and the mirror showing everything...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  },
  {
    id: 'h5_166',
    text: "I'm a massage therapist and you booked the 'couples special' — but your partner is running late. I tell you we should start without them. My hands work down your body, and by the time your partner arrives, they find us in a compromising position. Instead of being upset, they want to join. Describe every detail — the oil, the hands, the three-way dynamic that unfolds on that table...",
    category: 'roleplay',
    heat: 5,
    relationshipDuration: 'any'
  }
];

data.items.push(...newPrompts);

fs.writeFileSync('./content/prompts.json', JSON.stringify(data, null, 2));

const counts = {};
data.items.forEach(p => { counts[p.heat] = (counts[p.heat] || 0) + 1; });
console.log('Added', newPrompts.length, 'new heat-5 roleplay prompts');
console.log('New total:', data.items.length);
console.log('Distribution:', counts);

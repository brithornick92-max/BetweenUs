const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/dates.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/dates.json must have an items array');
}

const existingIds = new Set(data.items.map((item) => item.id));

const newDates = [
  // Heart + Chill + doing: +3
  {
    id: 'd789',
    title: 'Slow Breakfast Tray Together',
    minutes: 60,
    location: 'home',
    steps: [
      'Make a simple breakfast tray with coffee, fruit, toast, or whatever feels easy',
      'Arrange it like you are serving the morning to each other',
      'Eat slowly somewhere cozy with no screens',
      'Clean up together while naming one thing you appreciated about the morning'
    ],
    heat: 1,
    load: 1,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd790',
    title: 'Cozy Closet Memory Sort',
    minutes: 75,
    location: 'home',
    steps: [
      'Pick one drawer, shelf, or closet section to sort together',
      'Set aside items connected to memories, trips, or seasons of life',
      'Fold, donate, or save things with care',
      'End by choosing one meaningful item to keep visible'
    ],
    heat: 1,
    load: 1,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd791',
    title: 'Quiet Candle Reset',
    minutes: 45,
    location: 'home',
    steps: [
      'Light one candle and tidy one small area together',
      'Make the space feel calmer with blankets, music, or dim light',
      'Prepare tea, cocoa, or water',
      'Sit together for a few minutes and let the reset count as the date'
    ],
    heat: 1,
    load: 1,
    style: 'doing',
    releaseWeek: 0
  },

  // Play + Chill + talking: +3
  {
    id: 'd792',
    title: 'Ridiculous Ranking Night',
    minutes: 60,
    location: 'home',
    steps: [
      'Pick a silly category like best snacks, worst chores, or most dramatic movie moments',
      'Create a shared ranking list together',
      'Defend your choices with completely unnecessary passion',
      'Save the funniest ranking as an inside joke'
    ],
    heat: 2,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd793',
    title: 'Couch Commentary Awards',
    minutes: 75,
    location: 'home',
    steps: [
      'Watch a show, clips, old music videos, or trailers',
      'Pause occasionally to give fake award nominations',
      'Create awards like best chaos, best outfit, and most unhinged line',
      'Crown winners and choose one clip you would rewatch'
    ],
    heat: 2,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd794',
    title: 'Lazy Inside Joke Museum',
    minutes: 60,
    location: 'home',
    steps: [
      'List your funniest inside jokes, phrases, and random memories',
      'Give each one a fake museum title',
      'Tell the story behind each exhibit',
      'Choose one joke that deserves to come back into rotation'
    ],
    heat: 2,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },

  // Play + Moderate + talking: +3
  {
    id: 'd795',
    title: 'Fake Podcast Interview Date',
    minutes: 75,
    location: 'home',
    steps: [
      'Pretend one of you is hosting a relationship podcast',
      'Interview each other about love, habits, chaos, and favorite memories',
      'Switch host roles halfway through',
      'End by naming the episode title'
    ],
    heat: 2,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd796',
    title: 'Couples Hot Take Hour',
    minutes: 60,
    location: 'home',
    steps: [
      'Each write five harmless hot takes about food, movies, habits, or date ideas',
      'Read them one at a time',
      'Debate dramatically but kindly',
      'Vote on the take that deserves to become household law'
    ],
    heat: 2,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd797',
    title: 'Dream Business Pitch',
    minutes: 75,
    location: 'home',
    steps: [
      'Each invent a fake business you would run together',
      'Pitch the concept, name, vibe, and dramatic origin story',
      'Ask investor-style questions',
      'Choose the business that would make the best sitcom'
    ],
    heat: 2,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Chill + doing: +3
  {
    id: 'd798',
    title: 'Slow Scent Ritual',
    minutes: 60,
    location: 'home',
    steps: [
      'Choose a few scents like lotion, oil, candles, or perfume',
      'Test them slowly and notice what moods they create',
      'Pick one scent that feels most like the night you want',
      'Use it to mark the start of a private, unrushed evening'
    ],
    heat: 3,
    load: 1,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd799',
    title: 'Low-Light Touch Map',
    minutes: 60,
    location: 'home',
    steps: [
      'Set soft lighting and agree to keep the pace slow',
      'Take turns showing where touch feels calming, grounding, or inviting',
      'Use simple words like softer, slower, yes, and pause',
      'End by thanking each other for listening closely'
    ],
    heat: 3,
    load: 1,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd800',
    title: 'Silk and Candle Setup',
    minutes: 45,
    location: 'home',
    steps: [
      'Gather soft fabrics, candles, music, or anything that changes the room',
      'Build a cozy private setup together',
      'Take turns adjusting one detail until it feels right',
      'Let the finished atmosphere guide the rest of the night'
    ],
    heat: 3,
    load: 1,
    style: 'doing',
    releaseWeek: 0
  },

  // Heat + Active + doing: +3
  {
    id: 'd801',
    title: 'Sultry Choreography Challenge',
    minutes: 90,
    location: 'home',
    steps: [
      'Choose one bold song and one playful song',
      'Build a simple routine together with dramatic confidence',
      'Perform it once badly and once with full commitment',
      'End with a slow cooldown dance'
    ],
    heat: 3,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd802',
    title: 'Flirty Obstacle Relay',
    minutes: 75,
    location: 'home',
    steps: [
      'Create a playful obstacle course with pillows, chairs, or household items',
      'Add challenges like compliments, balance, or dramatic poses',
      'Race or guide each other through the course',
      'Celebrate with a victory snack or slow dance'
    ],
    heat: 3,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd803',
    title: 'Bold Outfit Challenge',
    minutes: 75,
    location: 'home',
    steps: [
      'Each create one outfit that makes you feel confident',
      'Add music and reveal the looks one at a time',
      'Give specific compliments about presence, not just appearance',
      'Choose one detail to bring into a future night out'
    ],
    heat: 3,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },

  // Heart + Active + mixed: +3
  {
    id: 'd804',
    title: 'Kindness Errand Adventure',
    minutes: 90,
    location: 'out',
    steps: [
      'Choose one helpful errand or small act of kindness',
      'Do it together while adding one treat stop along the way',
      'Talk about how you each show care through action',
      'End by naming one kind thing your partner did that mattered'
    ],
    heat: 1,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd805',
    title: 'Photo Walk of Gratitude',
    minutes: 90,
    location: 'out',
    steps: [
      'Take a long walk with your camera open',
      'Each photograph five things that make you feel grateful',
      'Compare your photos over a drink or snack',
      'Choose one image that represents your relationship right now'
    ],
    heat: 1,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd806',
    title: 'Memory Trail and Snack Stop',
    minutes: 105,
    location: 'out',
    steps: [
      'Pick a route with a few places tied to memories or future dreams',
      'At each stop, share one story or hope',
      'Add a snack stop halfway through',
      'End by choosing one memory you want to preserve'
    ],
    heat: 1,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },

  // Play + Active + talking: +3
  {
    id: 'd807',
    title: 'Adventure Review Walk',
    minutes: 90,
    location: 'out',
    steps: [
      'Do something active or playful together',
      'Take a walk afterward to review it like critics',
      'Rate fun, chaos, teamwork, and replay value',
      'Plan the upgraded version before you go home'
    ],
    heat: 2,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd808',
    title: 'Local Attraction Commentary Date',
    minutes: 105,
    location: 'out',
    steps: [
      'Visit a touristy or local attraction nearby',
      'Narrate the experience like hosts of a travel show',
      'Ask each other dramatic interview questions along the way',
      'End with an official rating and a ridiculous tagline'
    ],
    heat: 2,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd809',
    title: 'Food Crawl Debate Date',
    minutes: 105,
    location: 'out',
    steps: [
      'Visit two or three casual food spots',
      'Debate the best bite, best vibe, and best value',
      'Create a fake award for each stop',
      'Pick the winner and decide who you would bring there next'
    ],
    heat: 2,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Moderate + doing: +3
  {
    id: 'd810',
    title: 'Private Mood Setup Challenge',
    minutes: 75,
    location: 'home',
    steps: [
      'Each take ten minutes to adjust the room for a private mood',
      'Use lighting, music, scent, texture, or layout',
      'Reveal your setup choices to each other',
      'Combine the best details into one final atmosphere'
    ],
    heat: 3,
    load: 2,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd811',
    title: 'Sensory Tray Build',
    minutes: 75,
    location: 'home',
    steps: [
      'Build a tray with different textures, tastes, scents, and sounds',
      'Arrange it like a private tasting experience',
      'Take turns leading each other through the tray',
      'Keep the items that created the best mood'
    ],
    heat: 3,
    load: 2,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd812',
    title: 'Slow Dance Lesson at Home',
    minutes: 75,
    location: 'home',
    steps: [
      'Choose a slow, sensual song and a more playful song',
      'Learn or invent a few simple dance moves',
      'Practice leading and following',
      'End with one full song danced without talking'
    ],
    heat: 3,
    load: 2,
    style: 'doing',
    releaseWeek: 0
  },

  // Heat + Active + talking: +3
  {
    id: 'd813',
    title: 'Spark Questions on a Night Walk',
    minutes: 90,
    location: 'out',
    steps: [
      'Take a night walk somewhere safe and energized',
      'Ask questions about pursuit, flirtation, and what keeps things alive',
      'Pause when an answer feels important',
      'Choose one answer to act on later'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd814',
    title: 'Dressed-Up Attraction Talk',
    minutes: 90,
    location: 'out',
    steps: [
      'Dress up and go somewhere with atmosphere',
      'Talk about what you notice when your partner feels confident',
      'Share what kind of attention makes you feel magnetic',
      'End with one bold compliment each'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd815',
    title: 'Late-Night Chemistry Walkthrough',
    minutes: 90,
    location: 'out',
    steps: [
      'Walk through a lively street, market, or downtown area',
      'Point out details that change the mood between you',
      'Talk about what kind of atmosphere awakens desire',
      'Choose one detail to recreate privately later'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },

  // Heart + Active + doing: +2
  {
    id: 'd816',
    title: 'Shared Project Sprint',
    minutes: 90,
    location: 'home',
    steps: [
      'Choose one meaningful home, memory, or relationship project',
      'Set a timer and work on it side by side',
      'Take one progress photo',
      'End by naming what the project represents for your future'
    ],
    heat: 1,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd817',
    title: 'Community Care Date',
    minutes: 120,
    location: 'out',
    steps: [
      'Choose a community task, donation drop-off, cleanup, or volunteer opportunity',
      'Do the work together with intention',
      'Notice how your partner shows up when care becomes action',
      'Debrief over coffee or a simple meal'
    ],
    heat: 1,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },

  // Heat + Moderate + talking: +2
  {
    id: 'd818',
    title: 'Chemistry Repair Conversation',
    minutes: 75,
    location: 'home',
    steps: [
      'Talk gently about where chemistry has felt easy and where it has felt interrupted',
      'Name what helps each of you come back without pressure',
      'Ask what would make closeness feel more invited',
      'Choose one repair or reconnection cue to practice'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd819',
    title: 'The Private Preference Interview',
    minutes: 75,
    location: 'home',
    steps: [
      'Interview each other about atmosphere, words, pace, touch, and aftercare',
      'Answer with specifics rather than generalities',
      'Mark which preferences are current and which may change',
      'Save the answers as a living conversation, not a fixed rulebook'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },

  // Play + Moderate + mixed: +2
  {
    id: 'd820',
    title: 'Mystery Box Date Night',
    minutes: 90,
    location: 'home',
    steps: [
      'Each secretly choose three small items from around the house',
      'Put them in a bag or box',
      'Take turns drawing items and inventing a date rule around each one',
      'Play through the rules and vote on the funniest moment'
    ],
    heat: 2,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd821',
    title: 'DIY Game Night Remix',
    minutes: 90,
    location: 'home',
    steps: [
      'Choose a board game, card game, or phone game',
      'Add three custom rules that make it more personal',
      'Play one full round with the new rules',
      'Keep the best rule for future game nights'
    ],
    heat: 2,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },

  // Heat + Active + mixed: +2
  {
    id: 'd822',
    title: 'Bold Night Out Bingo',
    minutes: 120,
    location: 'out',
    steps: [
      'Make a bingo card with public-safe spark moments',
      'Include things like bold compliment, favorite song, close photo, and secret signal',
      'Check off squares throughout the night',
      'End by choosing the square that created the most chemistry'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd823',
    title: 'Three-Location Chemistry Trail',
    minutes: 120,
    location: 'out',
    steps: [
      'Choose three nearby places with different moods',
      'At each place, do one small activity and answer one bold question',
      'Notice which location brought out the most spark',
      'Plan a full date around that energy later'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  }
];

const duplicates = newDates.filter((date) => existingIds.has(date.id));
if (duplicates.length > 0) {
  throw new Error(`Duplicate date ids: ${duplicates.map((date) => date.id).join(', ')}`);
}

data.items.push(...newDates);
data.meta.description = `${data.items.length} unique date ideas with multi-dimensional filtering`;

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

console.log(`Added ${newDates.length} dates.`);
console.log(`New total: ${data.items.length}`);

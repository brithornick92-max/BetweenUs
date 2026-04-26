const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/dates.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/dates.json must have an items array');
}

const existingIds = new Set(data.items.map((item) => item.id));

const newDates = [
  // Heat + Active + talking
  {
    id: 'd735',
    title: 'Neon Walk Desire Questions',
    minutes: 90,
    location: 'out',
    steps: [
      'Walk somewhere with lights, music, or a little nighttime energy',
      'Ask each other what makes attraction feel exciting instead of routine',
      'Share one kind of attention you want more of lately',
      'End by choosing one small way to create more spark this week'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd736',
    title: 'After-Party Chemistry Debrief',
    minutes: 105,
    location: 'out',
    steps: [
      'Go to a lively event, show, restaurant, or busy area',
      'Notice what makes your partner feel most magnetic tonight',
      'Debrief over dessert, drinks, or a late-night snack',
      'Name the exact moment you felt most drawn to each other'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd737',
    title: 'Bold Compliment Walking Date',
    minutes: 75,
    location: 'out',
    steps: [
      'Take a brisk walk somewhere you can talk privately',
      'Trade bold compliments that are specific and real',
      'Ask what kind of words make each of you feel wanted',
      'Choose one compliment to repeat on an ordinary day'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd738',
    title: 'Spark Audit Night Out',
    minutes: 120,
    location: 'out',
    steps: [
      'Go somewhere that feels different from your usual routine',
      'Talk about what has been keeping the spark alive',
      'Name what has been dimming it without blaming each other',
      'Pick one exciting thing to bring back into your relationship'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd739',
    title: 'Confidence Walk and Confessions',
    minutes: 90,
    location: 'out',
    steps: [
      'Dress in a way that makes each of you feel confident',
      'Walk somewhere with a little atmosphere',
      'Tell each other what confidence looks like on your partner',
      'Share one private confession about attraction or desire'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd740',
    title: 'Late-Night Window Shopping for Desire',
    minutes: 90,
    location: 'out',
    steps: [
      'Walk through a shopping district, downtown area, or stylish street',
      'Point out textures, colors, outfits, or objects that feel sensual to you',
      'Talk about the mood each one creates',
      'Choose one inspiration to recreate at home later'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd741',
    title: 'Chemistry Questions on the Move',
    minutes: 90,
    location: 'out',
    steps: [
      'Choose a route with several places to pause',
      'At every stop, ask one question about pursuit, anticipation, or attention',
      'Keep answers honest but kind',
      'End by naming what surprised you most'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd742',
    title: 'Night Market Spark Interview',
    minutes: 105,
    location: 'out',
    steps: [
      'Visit a night market, food hall, or busy evening spot',
      'Ask each other questions between bites or stops',
      'Talk about what kind of atmosphere brings out your bold side',
      'End with one shared idea for a future private night'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd743',
    title: 'Desire Debrief Drive',
    minutes: 90,
    location: 'out',
    steps: [
      'Take a safe evening drive with a charged playlist',
      'Ask what kind of buildup feels best to each of you',
      'Stop somewhere scenic or quiet for a short walk',
      'Choose one song as your future spark cue'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Moderate + talking
  {
    id: 'd744',
    title: 'The Invitation Conversation',
    minutes: 60,
    location: 'home',
    steps: [
      'Sit close with low lighting and no phones',
      'Talk about how you each like intimacy to be initiated',
      'Name what feels inviting, what feels pressuring, and what feels playful',
      'Create one invitation phrase you both like'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd745',
    title: 'Anticipation Blueprint',
    minutes: 75,
    location: 'home',
    steps: [
      'Talk about what makes anticipation feel exciting',
      'Each describe a perfect slow build from ordinary evening to private closeness',
      'Compare the details that matter most',
      'Choose one small part to try this week'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd746',
    title: 'The Desire Weather Report',
    minutes: 60,
    location: 'home',
    steps: [
      'Describe your current desire as weather: clear, foggy, stormy, warm, restless, or quiet',
      'Ask what helps the weather shift in a good direction',
      'Name one thing that has helped recently',
      'End with a simple request or appreciation'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd747',
    title: 'Private Compliment Exchange',
    minutes: 60,
    location: 'home',
    steps: [
      'Each write five compliments that feel more intimate than everyday praise',
      'Read them slowly, one at a time',
      'Ask which compliment felt easiest and hardest to receive',
      'Save one sentence to reuse later'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd748',
    title: 'Curiosity, Not Pressure Talk',
    minutes: 75,
    location: 'home',
    steps: [
      'Set the rule that everything tonight is curiosity, not obligation',
      'Each name one thing you are curious about and one thing you are not interested in',
      'Ask what emotional need sits underneath each curiosity',
      'Thank each other for the honesty before making any plans'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd749',
    title: 'The Attention Inventory',
    minutes: 60,
    location: 'home',
    steps: [
      'Talk about the kinds of attention that make you feel most desired',
      'Sort examples into words, gestures, touch, planning, and atmosphere',
      'Each choose your top two',
      'Decide one way to offer that attention more intentionally'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd750',
    title: 'Private Yes, Maybe, Later',
    minutes: 75,
    location: 'home',
    steps: [
      'Make three columns: yes, maybe, and later',
      'Talk through moods, settings, words, and experiences',
      'Place each idea without judgment',
      'Choose one yes that feels simple and one maybe to keep discussing'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd751',
    title: 'The Feeling Desired Interview',
    minutes: 60,
    location: 'home',
    steps: [
      'Interview each other about the last time you felt truly desired',
      'Ask what made it feel real',
      'Name what you want more of and what you want less of',
      'End by offering one specific affirmation'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd752',
    title: 'Desire and Safety Check-In',
    minutes: 75,
    location: 'home',
    steps: [
      'Talk about what helps desire and safety exist at the same time',
      'Each name one thing that relaxes your body',
      'Each name one thing that helps you feel chosen',
      'Create a simple check-in question for future intimate moments'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Active + mixed
  {
    id: 'd753',
    title: 'Flirty Scavenger Night Out',
    minutes: 105,
    location: 'out',
    steps: [
      'Create a list of five things to find: a red light, a velvet texture, a bold outfit, a secret corner, and a perfect song',
      'Walk or drive until you find them',
      'At each find, answer one flirtatious question',
      'End by choosing the moment that felt most cinematic'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd754',
    title: 'Dressed-Up Stranger Game',
    minutes: 120,
    location: 'out',
    steps: [
      'Dress up and meet somewhere as if it is your first date',
      'Ask questions you would ask if you were trying to win each other over again',
      'Let the flirtation build without rushing',
      'Break character at the end and share what worked'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd755',
    title: 'Three-Scene Date Night',
    minutes: 120,
    location: 'out',
    steps: [
      'Plan three scenes: playful, romantic, and bold',
      'Choose one location or activity for each scene',
      'At every scene, take one photo and answer one chemistry question',
      'Rank the scenes and plan a full version of the winner'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd756',
    title: 'After-Dark Photo Booth Quest',
    minutes: 90,
    location: 'out',
    steps: [
      'Find a photo booth, mirror wall, or good lighting spot',
      'Take one sweet photo, one silly photo, and one confident photo',
      'Talk about which version feels most like you tonight',
      'Keep the favorite somewhere private or special'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd757',
    title: 'Spark Signal Date',
    minutes: 90,
    location: 'out',
    steps: [
      'Go somewhere lively enough to create energy',
      'Invent three subtle signals: more, slower, and closer',
      'Use them playfully throughout the date',
      'Debrief which signal felt most natural'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd758',
    title: 'Lounge Night Chemistry Game',
    minutes: 120,
    location: 'out',
    steps: [
      'Go to a lounge, patio, hotel bar, or moody restaurant',
      'Create a game of noticing atmosphere, attraction, and tension',
      'Ask each other a bold question between rounds',
      'Leave with one private idea inspired by the place'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd759',
    title: 'The Bold Errand Date',
    minutes: 90,
    location: 'out',
    steps: [
      'Turn an ordinary errand into a deliberately flirty outing',
      'Dress a little better than the errand requires',
      'Compliment each other while moving through the task',
      'Add one spontaneous stop that shifts the mood'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd760',
    title: 'Dance Floor Debrief',
    minutes: 120,
    location: 'out',
    steps: [
      'Go somewhere with dancing or music',
      'Dance close for at least one song if it feels good',
      'Step aside afterward and talk about what the movement brought up',
      'Choose one song to keep for a private playlist'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd761',
    title: 'Midnight Adventure With Rules',
    minutes: 105,
    location: 'out',
    steps: [
      'Set three rules before leaving, like no phones, say yes to one detour, and give one bold compliment',
      'Go somewhere open late or take a safe night drive',
      'Let the rules shape the date',
      'End by deciding which rule should become a tradition'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },

  // Heart + Active + talking
  {
    id: 'd762',
    title: 'Long Walk Relationship Review',
    minutes: 90,
    location: 'out',
    steps: [
      'Choose a route that gives you enough time to settle in',
      'Share what has felt strongest between you lately',
      'Name one place where you want more tenderness or teamwork',
      'End with one promise for the coming week'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd763',
    title: 'Farmers Market Future Talk',
    minutes: 90,
    location: 'out',
    steps: [
      'Walk through a farmers market or outdoor market together',
      'Use what you see as prompts for future-life questions',
      'Talk about food, home, family, travel, and routines',
      'Choose one small item that represents a shared hope'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd764',
    title: 'Trail Talk About Becoming',
    minutes: 105,
    location: 'out',
    steps: [
      'Take a trail, park loop, or long neighborhood walk',
      'Talk about who you are each becoming in this season',
      'Ask how your partner wants to be supported',
      'End with one encouragement you want them to carry home'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd765',
    title: 'Memory District Walk',
    minutes: 105,
    location: 'out',
    steps: [
      'Walk through an area tied to your past or your dreams',
      'Tell stories from earlier versions of yourselves',
      'Ask what each version needed most',
      'Name how your relationship helps you now'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd766',
    title: 'Bookstore to Bench Conversation',
    minutes: 90,
    location: 'out',
    steps: [
      'Browse a bookstore and each choose one book that reveals something about you',
      'Walk to a bench, café, or park spot',
      'Explain your choices and what they say about this season of life',
      'Choose one question from the books to keep discussing'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd767',
    title: 'Shared Values Walking Date',
    minutes: 90,
    location: 'out',
    steps: [
      'Pick a route with several places to pause',
      'At each pause, name one value that matters to you',
      'Talk about where your values overlap and where they differ',
      'Choose one value you want to live out together this month'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd768',
    title: 'What Home Means Walk',
    minutes: 90,
    location: 'out',
    steps: [
      'Walk through a neighborhood, park, or town that feels interesting',
      'Talk about what makes a place feel like home',
      'Share what emotional home feels like with each other',
      'End by naming one thing that makes your relationship feel safe'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd769',
    title: 'Milestone Walk and Toast',
    minutes: 90,
    location: 'out',
    steps: [
      'Choose a milestone worth honoring, big or small',
      'Take a walk and tell the story of how you got there',
      'Stop for a drink, snack, or view',
      'Toast to the next milestone you want to reach together'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd770',
    title: 'Future Us Interview Walk',
    minutes: 105,
    location: 'out',
    steps: [
      'Walk somewhere with room to imagine',
      'Interview each other as if you are five years older',
      'Answer questions about what future-you is proud of',
      'Name one small choice that helps that future become possible'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Chill + talking
  {
    id: 'd771',
    title: 'Candlelit Desire Check-In',
    minutes: 60,
    location: 'home',
    steps: [
      'Light a candle and make the room feel calm',
      'Ask what has been helping closeness lately',
      'Ask what has been making desire feel harder to access',
      'End with one gentle invitation and one appreciation'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd772',
    title: 'Soft Boundary Pillow Talk',
    minutes: 60,
    location: 'home',
    steps: [
      'Get cozy and agree that honesty is the goal',
      'Talk about what feels inviting, neutral, and not-right-now',
      'Ask how each of you likes to be checked in with',
      'Choose one boundary-respecting phrase for future intimacy'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd773',
    title: 'Whispered Want List',
    minutes: 45,
    location: 'home',
    steps: [
      'Turn the lights low and sit close',
      'Each whisper three things you want more of in your connection',
      'Ask which one feels easiest to start with',
      'End by choosing one tiny next step'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd774',
    title: 'Comfort and Chemistry Talk',
    minutes: 60,
    location: 'home',
    steps: [
      'Set up pillows, blankets, and a warm drink',
      'Talk about how comfort and chemistry interact for each of you',
      'Name one comfort that makes you feel more open',
      'Name one chemistry cue you want your partner to notice'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd775',
    title: 'Low-Energy Spark Conversation',
    minutes: 45,
    location: 'home',
    steps: [
      'Choose a calm spot where neither of you has to perform',
      'Talk about what kind of spark still works when you are tired',
      'Each name one low-effort gesture that feels intimate',
      'Save the list for a real low-energy night'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd776',
    title: 'Sensual Memory Share',
    minutes: 60,
    location: 'home',
    steps: [
      'Sit together somewhere comfortable',
      'Share a memory when you felt especially connected or desired',
      'Describe the atmosphere, not just what happened',
      'Ask what part of that memory you could bring back gently'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd777',
    title: 'The Slow Yes Conversation',
    minutes: 60,
    location: 'home',
    steps: [
      'Talk about what makes a yes feel relaxed instead of rushed',
      'Each describe the pace that helps you feel present',
      'Name one sign that you are warming up and one sign you need more time',
      'Create a shared rule for honoring both'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd778',
    title: 'Aftercare Ideas Night',
    minutes: 60,
    location: 'home',
    steps: [
      'Talk about what helps you feel cared for after emotional or intimate closeness',
      'Make a list of small aftercare options',
      'Choose favorites for tired nights, tender nights, and playful nights',
      'Save the list somewhere private'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd779',
    title: 'Private Reassurance Date',
    minutes: 45,
    location: 'home',
    steps: [
      'Sit close with no multitasking',
      'Each share what reassurance helps you feel wanted',
      'Practice saying one reassurance in your own words',
      'End with a long hug or quiet closeness'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Moderate + mixed
  {
    id: 'd780',
    title: 'Mood Board for a Private Night',
    minutes: 75,
    location: 'home',
    steps: [
      'Gather images, songs, textures, scents, or colors',
      'Build a mood board for a night you would both enjoy',
      'Talk through what each detail creates emotionally',
      'Choose one detail to make real soon'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd781',
    title: 'Touch Language Cards',
    minutes: 75,
    location: 'home',
    steps: [
      'Make cards with words like soft, firm, slow, playful, close, and pause',
      'Talk about what each word means to you',
      'Sort cards into favorites, curious, and not tonight',
      'Keep the deck for future check-ins'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd782',
    title: 'Chemistry Playlist and Questions',
    minutes: 75,
    location: 'home',
    steps: [
      'Build a playlist together from calm to charged',
      'For every few songs, answer one chemistry question',
      'Notice which songs change your body language or mood',
      'Save the final order for a future date'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd783',
    title: 'Dessert and Desire Cards',
    minutes: 75,
    location: 'home',
    steps: [
      'Prepare or buy a dessert to share slowly',
      'Write desire-themed questions on cards',
      'Draw one card between bites',
      'Set aside any card that feels better for later'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd784',
    title: 'Private Atmosphere Lab',
    minutes: 90,
    location: 'home',
    steps: [
      'Experiment with lighting, music, scent, and seating',
      'Change one element at a time and notice how the room feels',
      'Talk about what makes each of you feel more open',
      'Save your favorite atmosphere as a repeatable setup'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd785',
    title: 'Invitation Jar Night',
    minutes: 75,
    location: 'home',
    steps: [
      'Write invitation ideas on slips of paper',
      'Include gentle, playful, bold, and cozy options',
      'Read them aloud and sort them by comfort level',
      'Choose one invitation to keep for this week'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd786',
    title: 'Senses and Signals Date',
    minutes: 75,
    location: 'home',
    steps: [
      'Choose one scent, one sound, one texture, and one taste',
      'Talk about the feeling each one creates',
      'Create a small signal for more, pause, or slower',
      'Use the signals only as playful practice tonight'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd787',
    title: 'Slow-Burn Story Cards',
    minutes: 75,
    location: 'home',
    steps: [
      'Write five story prompts that start with an ordinary moment',
      'Take turns adding details that slowly raise the tension',
      'Pause to talk about what made the story feel compelling',
      'Save the best prompt for a future private story'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd788',
    title: 'The Private Menu Draft',
    minutes: 90,
    location: 'home',
    steps: [
      'Create a playful menu with sections for atmosphere, words, touch, pace, and aftercare',
      'Each add options under every section',
      'Mark items as yes, maybe, or later',
      'Choose one simple combination to revisit another night'
    ],
    heat: 3,
    load: 2,
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

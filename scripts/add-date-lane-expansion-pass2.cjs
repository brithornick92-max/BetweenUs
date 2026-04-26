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
    id: 'd675',
    title: 'After-Dark Chemistry Walk',
    minutes: 90,
    location: 'out',
    steps: [
      'Choose a safe, lively area for an evening walk',
      'Take turns asking bold questions about attraction and chemistry',
      'Pause somewhere quiet to share what has been pulling you closer lately',
      'End by choosing one private signal for when you want more attention'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd676',
    title: 'City Lights Desire Interview',
    minutes: 105,
    location: 'out',
    steps: [
      'Walk or drive somewhere with city lights',
      'Interview each other like you are trying to understand what awakens desire',
      'Ask what kind of pursuit, attention, and anticipation feels best',
      'Save one answer as inspiration for a future date'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd677',
    title: 'Bold Questions Dessert Crawl',
    minutes: 105,
    location: 'out',
    steps: [
      'Pick two dessert stops within walking or driving distance',
      'At each stop, ask one spicy but respectful question',
      'Keep the tone curious, not pressuring',
      'End by naming one answer you want to revisit later in private'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd678',
    title: 'Rooftop Attraction Debrief',
    minutes: 90,
    location: 'out',
    steps: [
      'Find a rooftop, overlook, patio, or skyline view',
      'Talk about the moments when you feel most drawn to each other',
      'Share what makes confidence feel magnetic to you',
      'Choose one way to bring more of that energy into ordinary days'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd679',
    title: 'Live Music Spark Talk',
    minutes: 120,
    location: 'out',
    steps: [
      'Go somewhere with live music or a strong atmosphere',
      'Notice which songs shift the mood between you',
      'Afterward, talk about rhythm, closeness, and what felt electric',
      'Save one song as a private spark cue'
    ],
    heat: 3,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Moderate + talking
  {
    id: 'd680',
    title: 'Desire Menu Conversation',
    minutes: 75,
    location: 'home',
    steps: [
      'Make drinks or snacks that feel a little elevated',
      'Each write a menu of words, moods, touch, and attention you want more of',
      'Trade menus and ask curious questions without rushing',
      'Circle one shared yes to explore another night'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd681',
    title: 'Fantasy Without Pressure',
    minutes: 75,
    location: 'home',
    steps: [
      'Agree that sharing an idea does not mean promising to do it',
      'Each share one mood, scene, or dynamic that feels intriguing',
      'Ask what part of it appeals emotionally',
      'Sort ideas into yes, curious, maybe someday, and not for us'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd682',
    title: 'Turn-On Timeline Talk',
    minutes: 75,
    location: 'home',
    steps: [
      'Talk through what helps you move from daily-life mode into desire',
      'Name what makes you feel open, distracted, pursued, or connected',
      'Identify the kind of buildup each of you enjoys',
      'Create a tiny pre-intimacy ritual you both want to try'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd683',
    title: 'What Makes You Feel Wanted',
    minutes: 60,
    location: 'home',
    steps: [
      'Sit somewhere private and comfortable',
      'Take turns completing the sentence: I feel wanted when...',
      'Ask one follow-up question after every answer',
      'Repeat back what you want to remember about your partner'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd684',
    title: 'Private Language Date',
    minutes: 60,
    location: 'home',
    steps: [
      'Talk about words, phrases, and signals that make you feel desired',
      'Create three private phrases only the two of you understand',
      'Practice using them in playful, low-pressure sentences',
      'Save your favorite phrase as a future invitation'
    ],
    heat: 3,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Active + mixed
  {
    id: 'd685',
    title: 'Three-Stop Spark Date',
    minutes: 120,
    location: 'out',
    steps: [
      'Choose three stops: one playful, one romantic, and one bold',
      'At each stop, do one small activity and answer one chemistry question',
      'Notice which version of you comes alive in each place',
      'Choose the stop that deserves a full date later'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd686',
    title: 'Dancing Then Secrets',
    minutes: 120,
    location: 'out',
    steps: [
      'Go somewhere you can dance or move to music',
      'Stay close for at least one full song',
      'Step outside or sit somewhere quiet afterward',
      'Share one desire, compliment, or secret you have been holding back'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd687',
    title: 'Flirty Photo Mission',
    minutes: 90,
    location: 'out',
    steps: [
      'Choose three photo prompts before leaving',
      'Take photos that feel confident, playful, and a little bold',
      'Pick one favorite photo of each other',
      'Tell your partner exactly what you love about it'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd688',
    title: 'Festival Chemistry Game',
    minutes: 120,
    location: 'out',
    steps: [
      'Go to a fair, festival, night market, or busy event',
      'Create a game of finding things that match your chemistry',
      'Take one bold photo and one sweet photo',
      'End by naming the moment you felt most drawn together'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd689',
    title: 'Spark Hunt Around Town',
    minutes: 105,
    location: 'out',
    steps: [
      'Walk or drive to three places with different vibes',
      'At each place, name what mood it brings out in you',
      'Choose one place that makes you feel most drawn together',
      'Plan a future date around that exact energy'
    ],
    heat: 3,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },

  // Heart + Active + talking
  {
    id: 'd690',
    title: 'Bridge Walk Big Questions',
    minutes: 90,
    location: 'out',
    steps: [
      'Find a bridge, boardwalk, or long path',
      'Ask each other three big life questions while you walk',
      'Pause at the midpoint to share one gratitude',
      'End by naming one dream you want to protect together'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd691',
    title: 'Legacy Walk and Talk',
    minutes: 105,
    location: 'out',
    steps: [
      'Walk somewhere peaceful but energizing',
      'Talk about the kind of legacy you each want to leave',
      'Share what values you want your relationship to embody',
      'Choose one small action that reflects those values this week'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd692',
    title: 'Coffee Crawl Life Chapters',
    minutes: 120,
    location: 'out',
    steps: [
      'Visit two coffee shops or cafés',
      'At the first stop, talk about who you were before this relationship',
      'At the second stop, talk about who you are becoming',
      'Walk between stops without checking your phones'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd693',
    title: 'Dream Neighborhood Walk',
    minutes: 90,
    location: 'out',
    steps: [
      'Walk through a neighborhood, town, or area you both like',
      'Talk about what kind of life you imagine there',
      'Notice homes, parks, shops, and details that appeal to you',
      'Name one shared dream that feels more real after walking'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd694',
    title: 'Scenic Drive Future Talk',
    minutes: 105,
    location: 'out',
    steps: [
      'Pick a scenic route with a calm playlist',
      'Take turns asking future-focused questions',
      'Stop somewhere beautiful for a short walk',
      'Name one future scene you both want to move toward'
    ],
    heat: 1,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Chill + talking
  {
    id: 'd695',
    title: 'Pillow Talk Desire Map',
    minutes: 60,
    location: 'home',
    steps: [
      'Get comfortable in bed or on the couch',
      'Talk about what makes desire feel safe, personal, and wanted',
      'Each name one kind of attention you want more often',
      'End by choosing one small signal for future closeness'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd696',
    title: 'Low-Light Yes List',
    minutes: 60,
    location: 'home',
    steps: [
      'Dim the lights and sit close',
      'Each make a short list of things that currently feel like yes',
      'Share what makes each yes appealing',
      'Pick one yes to keep in mind for another night'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd697',
    title: 'Cozy Fantasy Sorting',
    minutes: 75,
    location: 'home',
    steps: [
      'Bring blankets, drinks, and a no-pressure mindset',
      'Talk through ideas as categories: curious, maybe, no, and yes',
      'Ask what each idea represents emotionally',
      'End by thanking each other for being honest'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd698',
    title: 'Soft Voice Attraction Talk',
    minutes: 45,
    location: 'home',
    steps: [
      'Turn off bright lights and sit close enough to speak softly',
      'Tell your partner what you notice about them lately',
      'Ask what kind of compliments actually land',
      'Share one sentence you want to hear more often'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd699',
    title: 'Warm Drink Desire Debrief',
    minutes: 60,
    location: 'home',
    steps: [
      'Make tea, cocoa, or another warm drink',
      'Talk about what has been helping or blocking closeness lately',
      'Name one thing you each want to feel more of',
      'End with a clear, pressure-free invitation for future intimacy'
    ],
    heat: 3,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Moderate + mixed
  {
    id: 'd700',
    title: 'Scent, Song, and Desire Board',
    minutes: 75,
    location: 'home',
    steps: [
      'Choose a few scents, songs, textures, or images',
      'Build a small mood board for the kind of intimacy you want more of',
      'Explain why each piece belongs there',
      'Choose one element to bring into a future night'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd701',
    title: 'Invitation Cards Night',
    minutes: 75,
    location: 'home',
    steps: [
      'Write small invitation cards with different moods',
      'Include options like slow, playful, bold, tender, and curious',
      'Read them aloud and sort them by interest level',
      'Save the cards you both want to use later'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd702',
    title: 'Taste and Tension Pairing',
    minutes: 75,
    location: 'home',
    steps: [
      'Choose small bites with different flavors and textures',
      'Taste slowly and describe each one with a mood word',
      'Pair each bite with a flirtatious question',
      'End by choosing the pairing that felt most like your chemistry'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd703',
    title: 'Slow-Burn Playlist Lab',
    minutes: 75,
    location: 'home',
    steps: [
      'Build a playlist that moves from calm to charged',
      'For each song, say what mood it creates',
      'Reorder the songs until the pacing feels right',
      'Save the final playlist for a future private night'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd704',
    title: 'Desire Jar and Dessert',
    minutes: 75,
    location: 'home',
    steps: [
      'Write bold but comfortable prompts on slips of paper',
      'Share dessert while drawing one prompt at a time',
      'Answer, pass, or save each prompt for later',
      'Keep the jar somewhere private for future nights'
    ],
    heat: 3,
    load: 2,
    style: 'mixed',
    releaseWeek: 0
  },

  // Play + Chill + talking
  {
    id: 'd705',
    title: 'Couch Critics Night',
    minutes: 75,
    location: 'home',
    steps: [
      'Watch trailers, short clips, or old commercials together',
      'Rate them with dramatic commentary',
      'Invent awards for funniest, weirdest, and most romantic',
      'Pick one full movie or show for a future night'
    ],
    heat: 2,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd706',
    title: 'Silly Would-You-Rather Blanket Date',
    minutes: 60,
    location: 'home',
    steps: [
      'Get cozy under a blanket',
      'Take turns asking ridiculous would-you-rather questions',
      'Defend your answers like they matter deeply',
      'End with one sweet question about your relationship'
    ],
    heat: 2,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd707',
    title: 'Snack Ranking Committee',
    minutes: 60,
    location: 'home',
    steps: [
      'Gather five snacks you already have or can easily grab',
      'Taste and rank them with serious fake authority',
      'Create categories like romance snack, chaos snack, and comfort snack',
      'Crown one official relationship snack'
    ],
    heat: 2,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd708',
    title: 'Dream Vacation Debate',
    minutes: 75,
    location: 'home',
    steps: [
      'Each choose a wildly different dream trip',
      'Pitch your trip like you are trying to win your partner over',
      'Ask playful questions about food, chaos, rest, and romance',
      'Combine the best details into one imaginary trip'
    ],
    heat: 2,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd709',
    title: 'Pet Names and Inside Jokes Night',
    minutes: 45,
    location: 'home',
    steps: [
      'List your funniest inside jokes and nicknames',
      'Tell the origin story of each one',
      'Invent three new names or phrases you may never use again',
      'Save the one that makes you both laugh hardest'
    ],
    heat: 2,
    load: 1,
    style: 'talking',
    releaseWeek: 0
  },

  // Play + Moderate + talking
  {
    id: 'd710',
    title: 'Fake Travel Agent Pitch',
    minutes: 75,
    location: 'home',
    steps: [
      'Each secretly design a dream getaway for the other',
      'Pitch it like a dramatic luxury travel agent',
      'Ask follow-up questions about mood, budget, and chaos level',
      'Choose one detail to turn into a real mini-date'
    ],
    heat: 2,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd711',
    title: 'Relationship Debate Club',
    minutes: 60,
    location: 'home',
    steps: [
      'Pick playful debate topics about food, travel, chores, or pop culture',
      'Take turns defending the opposite of what you actually believe',
      'Award points for passion, absurdity, and charm',
      'End with one debate you agree on completely'
    ],
    heat: 2,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd712',
    title: 'Mystery Playlist Commentary',
    minutes: 75,
    location: 'home',
    steps: [
      'Each build a short mystery playlist for the other',
      'Play songs one at a time without explaining them first',
      'Guess why each song was chosen',
      'Reveal the real reason and save the best discovery'
    ],
    heat: 2,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd713',
    title: 'Two Truths and a Dream',
    minutes: 60,
    location: 'home',
    steps: [
      'Take turns sharing two true stories and one future dream',
      'Guess which one is the dream',
      'Ask follow-up questions after every round',
      'Choose one dream to encourage this month'
    ],
    heat: 2,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd714',
    title: 'Local Legend Story Swap',
    minutes: 90,
    location: 'either',
    steps: [
      'Look up local legends, weird history, or neighborhood rumors',
      'Each pick one story to retell dramatically',
      'Discuss which one would make the best movie',
      'Plan a future outing to visit one related place'
    ],
    heat: 2,
    load: 2,
    style: 'talking',
    releaseWeek: 0
  },

  // Heat + Active + doing
  {
    id: 'd715',
    title: 'Private Dance Lesson Challenge',
    minutes: 90,
    location: 'home',
    steps: [
      'Choose a sensual dance tutorial or freestyle playlist',
      'Learn a short routine together',
      'Take turns leading with confidence and humor',
      'End with one slow song and no performance pressure'
    ],
    heat: 3,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd716',
    title: 'Bedroom Runway Night',
    minutes: 75,
    location: 'home',
    steps: [
      'Each choose three outfits or looks',
      'Create a runway path with music',
      'Model each look with confidence',
      'Give specific compliments after every round'
    ],
    heat: 3,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd717',
    title: 'After-Dark Dance-Off',
    minutes: 75,
    location: 'home',
    steps: [
      'Make a playlist that builds from playful to sultry',
      'Take turns choosing the next move or song',
      'Keep score with compliments instead of points',
      'End with a slow dance to bring the energy down'
    ],
    heat: 3,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd718',
    title: 'Confidence Photo Studio',
    minutes: 90,
    location: 'home',
    steps: [
      'Create a simple photo corner with good lighting',
      'Dress in something that makes you feel magnetic',
      'Take turns directing confident, tasteful photos',
      'Choose one favorite and explain why it captures your partner'
    ],
    heat: 3,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd719',
    title: 'Passion Playlist Performance',
    minutes: 75,
    location: 'home',
    steps: [
      'Each pick three songs that make you feel bold',
      'Perform or move to one song while your partner watches kindly',
      'Switch roles and keep it playful',
      'Build a shared playlist from the songs that worked best'
    ],
    heat: 3,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },

  // Heart + Active + mixed
  {
    id: 'd720',
    title: 'Memory Map City Walk',
    minutes: 105,
    location: 'out',
    steps: [
      'Pick three places connected to your story or dreams',
      'Walk or drive between them',
      'At each stop, share one memory, one gratitude, and one hope',
      'Take a photo at the final stop'
    ],
    heat: 1,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd721',
    title: 'Volunteer Then Coffee Reflection',
    minutes: 120,
    location: 'out',
    steps: [
      'Volunteer together for a short shift or community task',
      'Notice how your partner shows care in action',
      'Get coffee afterward',
      'Share what you admired about each other'
    ],
    heat: 1,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd722',
    title: 'Hike and Future Letters',
    minutes: 120,
    location: 'out',
    steps: [
      'Take a scenic hike or long park walk',
      'Pause halfway to write short notes to your future selves',
      'Read one sentence out loud',
      'Save the notes for your next anniversary or milestone'
    ],
    heat: 1,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd723',
    title: 'Neighborhood Kindness Quest',
    minutes: 90,
    location: 'out',
    steps: [
      'Choose three small acts of kindness to do together',
      'Walk through your neighborhood completing them',
      'Take a quiet break afterward',
      'Talk about what kind of people you want to be together'
    ],
    heat: 1,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },
  {
    id: 'd724',
    title: 'Long Walk, Tiny Promises',
    minutes: 105,
    location: 'out',
    steps: [
      'Choose a route long enough to settle into real conversation',
      'Talk about what has felt good between you lately',
      'Each make one tiny promise for the next week',
      'End with a snack, drink, or quiet sit together'
    ],
    heat: 1,
    load: 3,
    style: 'mixed',
    releaseWeek: 0
  },

  // Play + Active + talking
  {
    id: 'd725',
    title: 'Theme Park Strategy Session',
    minutes: 120,
    location: 'out',
    steps: [
      'Go to a theme park, arcade strip, fair, or boardwalk',
      'Create a strategy for maximizing fun with limited time',
      'Talk through every dramatic decision like coaches',
      'End by ranking the best thrill and funniest mistake'
    ],
    heat: 2,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd726',
    title: 'Adventure Debrief Walk',
    minutes: 90,
    location: 'out',
    steps: [
      'Do one active thing like skating, bowling, hiking, or exploring',
      'Take a walk afterward',
      'Debrief what brought out your playful side',
      'Plan a rematch, sequel, or upgraded version'
    ],
    heat: 2,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd727',
    title: 'Food Truck Rating Tour',
    minutes: 105,
    location: 'out',
    steps: [
      'Visit two or three food trucks or casual spots',
      'Create a rating system with ridiculous categories',
      'Talk through each score like serious critics',
      'Crown the winner and choose your next food quest'
    ],
    heat: 2,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd728',
    title: 'Museum Hot Takes Date',
    minutes: 105,
    location: 'out',
    steps: [
      'Visit a museum, gallery, or unusual exhibit',
      'Share your funniest or boldest opinions about what you see',
      'Ask what each piece reminds your partner of',
      'End by choosing the exhibit that best describes your relationship'
    ],
    heat: 2,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },
  {
    id: 'd729',
    title: 'Local Quest Commentary',
    minutes: 90,
    location: 'out',
    steps: [
      'Pick a local attraction, trail, market, or event',
      'Narrate the outing like you are hosting a travel show',
      'Ask each other playful interview questions along the way',
      'End with your official review of the experience'
    ],
    heat: 2,
    load: 3,
    style: 'talking',
    releaseWeek: 0
  },

  // Heart + Active + doing
  {
    id: 'd730',
    title: 'Sunrise Service Date',
    minutes: 120,
    location: 'out',
    steps: [
      'Choose a morning volunteer task, cleanup, or helpful errand',
      'Do it together before the day gets busy',
      'Notice how your partner shows care through action',
      'Celebrate with breakfast and a gratitude toast'
    ],
    heat: 1,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd731',
    title: 'Memory Lane Bike Ride',
    minutes: 105,
    location: 'out',
    steps: [
      'Plan a bike ride past places with meaning or beauty',
      'Stop for one photo and one memory at each place',
      'Leave a kind note or small token somewhere appropriate',
      'End with a snack and a favorite moment recap'
    ],
    heat: 1,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd732',
    title: 'Build Something for Home',
    minutes: 120,
    location: 'home',
    steps: [
      'Choose a small home project you can finish together',
      'Gather supplies and divide roles',
      'Work side by side with music on',
      'Step back and name what the project adds to your shared life'
    ],
    heat: 1,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd733',
    title: 'Anniversary Photo Recreation Walk',
    minutes: 105,
    location: 'out',
    steps: [
      'Choose old photos from your relationship',
      'Visit places where you can recreate one or two of them',
      'Take updated versions with the same poses',
      'Make a side-by-side collage afterward'
    ],
    heat: 1,
    load: 3,
    style: 'doing',
    releaseWeek: 0
  },
  {
    id: 'd734',
    title: 'Shared Goal Action Date',
    minutes: 90,
    location: 'either',
    steps: [
      'Pick one goal you both care about',
      'Do one real action toward it together',
      'Document the first step with a photo, note, or calendar event',
      'Celebrate progress instead of perfection'
    ],
    heat: 1,
    load: 3,
    style: 'doing',
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

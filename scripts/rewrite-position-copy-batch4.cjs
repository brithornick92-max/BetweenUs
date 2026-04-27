const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/intimacy-positions.json must have an items array');
}

const patches = {
  ip127: {
    focus: 'A waist-guided position where the hands become part of the rhythm. One partner uses touch at the waist, hips, or lower back to help shape pace, pressure, and closeness, creating a position that feels directed without becoming rushed.',
    benefits: 'This position gives both partners a clearer way to communicate through the body. The hands can guide angle and rhythm while also adding a sense of being held, noticed, and physically tuned in.',
    makeItHotter: 'Let the guiding hands slow the pace first, then build from there. A firmer hold at the waist or a steady pull closer can make the position feel more intentional and charged.',
    comfort: 'Guidance should feel supportive, not restrictive. If the hold feels too tight or controlling, soften the hands and use lighter pressure at the waist or lower back.',
    whyPeopleLikeIt: 'It feels connected and easy to read. Many couples like it because the hands give clear feedback without needing a lot of verbal direction.',
    shortSummary: 'A waist-guided position where hands help shape rhythm, closeness, and pressure.'
  },

  ip128: {
    focus: 'An open-knee recline that creates more space through the hips while keeping the receiving partner supported. The shape feels open, direct, and easy to adjust with pillows, hand placement, and small changes in knee width.',
    benefits: 'The wider recline can create a clearer angle without requiring a complicated setup. It gives both partners room to move closer, slow down, or adjust pressure while the reclining partner stays grounded.',
    makeItHotter: 'Use hands at the thighs or hips to keep the open shape feeling supported. Slower movement can make the angle feel stronger without needing speed.',
    comfort: 'Do not force the knees wider than feels natural. Use pillows under the knees or hips if the lower back, inner thighs, or hips start to feel strained.',
    whyPeopleLikeIt: 'It feels open but still supported. Many people like it because the position gives a stronger angle while keeping the body relaxed.',
    shortSummary: 'An open-knee recline with a supported angle, clear access, and adjustable closeness.'
  },

  ip129: {
    focus: 'A slow deep-contact position where pressure matters more than speed. The bodies stay close and aligned, using small shifts and steady weight to make the moment feel intense, grounded, and fully present.',
    benefits: 'The position can make intimacy feel more immersive because the movement stays compact and connected. It works well for couples who want depth, closeness, and a slower pace that still feels charged.',
    makeItHotter: 'Stay close and let pressure build gradually. Pausing at the closest point, changing the hip angle slightly, or holding the body still for a breath can make the sensation stronger.',
    comfort: 'Support the partner above through arms, elbows, or pillows so the partner below can breathe comfortably. If pressure feels too heavy, create space at the chest while keeping the hips close.',
    whyPeopleLikeIt: 'It feels intense without needing to be fast. Many couples like it because the closeness and pressure create a full-body feeling.',
    shortSummary: 'A slow deep-contact position built around pressure, closeness, and grounded intensity.'
  },

  ip130: {
    focus: 'A consistent-rhythm position that keeps the pace steady instead of constantly changing. The shape can be simple, but the repeated rhythm creates a focused, reliable flow that both partners can settle into.',
    benefits: 'A steady beat can make intimacy feel calming and satisfying at the same time. It helps partners synchronize, notice each other’s responses, and stay connected without overthinking the next move.',
    makeItHotter: 'Choose one rhythm and stay with it longer than usual. Add intensity through pressure, eye contact, or a pause instead of immediately changing speed.',
    comfort: 'Keep the movement small enough that neither partner has to brace. If fatigue builds, reduce the range but keep the same steady tempo.',
    whyPeopleLikeIt: 'It feels reliable and easy to follow. Many people like it because the steady pace lets the body relax into the rhythm.',
    shortSummary: 'A consistent-rhythm position that uses steadiness, repetition, and shared pacing.'
  },

  ip131: {
    focus: 'A rocking side position that moves like a slow tide. Both partners stay mostly supported on their sides while the rhythm comes from small rolling motions through the hips and thighs.',
    benefits: 'This position is gentle on the body while still offering a clear sensual rhythm. It works well when partners want closeness, softness, and movement that does not require much strength.',
    makeItHotter: 'Let the rocking become predictable, then add a pause or closer pull through the hips. The contrast between soft motion and stillness can make the rhythm feel more intimate.',
    comfort: 'Use pillows under the head and between the knees. If either partner feels twisted, loosen the legs and rebuild the position with the spine more neutral.',
    whyPeopleLikeIt: 'It feels soothing and connected. Many couples like it because side-lying support makes the rhythm easy to sustain.',
    shortSummary: 'A side-lying rocking position with a soft, rolling rhythm and low-effort closeness.'
  },

  ip132: {
    focus: 'A diagonal body angle that shifts the usual line of contact into something more exploratory. The partners stay close, but the bodies rotate slightly so the sensation comes from angle and alignment instead of a brand-new setup.',
    benefits: 'The diagonal shape can make a familiar position feel fresh. It gives partners a way to explore different pressure points and body contact while still staying supported and connected.',
    makeItHotter: 'Rotate slowly and test small changes before adding pace. A hand at the hip, thigh, or waist can help hold the diagonal angle in a way that feels secure.',
    comfort: 'Avoid twisting through the spine. If the diagonal shape feels awkward, reduce the rotation and use pillows to support the hips or knees.',
    whyPeopleLikeIt: 'It feels novel without being overwhelming. Many people like it because a slight body angle can completely change the sensation.',
    shortSummary: 'A diagonal-angle position that refreshes a familiar shape with subtle rotation and alignment.'
  },

  ip133: {
    focus: 'A hip-elevation position that uses lift to create a pearl-like point of focus through the pelvis. The receiving partner stays supported while the added height creates a clearer, more concentrated angle.',
    benefits: 'The lift can make the position feel more precise without requiring the body to hold an active bridge. It gives the partner above or in front a stable way to adjust closeness, pressure, and rhythm.',
    makeItHotter: 'Start with a gentle lift and let the angle do the work. Slower motion, a hand at the hips, or a pause at the deepest point can make the position feel more intense.',
    comfort: 'Support the hips evenly and keep the lower back relaxed. If the lift feels too sharp, lower the support or add a pillow under the knees.',
    whyPeopleLikeIt: 'It feels focused and supported. Many couples like it because the elevation changes the experience without making the setup complicated.',
    shortSummary: 'A supported hip-elevation position that creates a focused angle and steady closeness.'
  },

  ip134: {
    focus: 'A chest-to-chest rhythm position where the closeness stays continuous and the movement stays warm. Both partners remain physically connected through the front body, letting rhythm come from pressure and subtle shifts.',
    benefits: 'The position keeps emotional and physical connection tied together. It is especially useful when couples want sensual movement without losing the face-to-face or body-to-body feeling.',
    makeItHotter: 'Keep the chest close and slow the rhythm down. A hand at the back of the neck, waist, or lower back can make the closeness feel more deliberate.',
    comfort: 'Support weight through forearms, elbows, or pillows as needed. If breathing feels restricted, create a little more space at the chest while keeping the hips connected.',
    whyPeopleLikeIt: 'It feels intimate and steady. Many couples like it because the rhythm stays connected to warmth, breath, and full-body contact.',
    shortSummary: 'A chest-to-chest rhythm position built around warmth, pressure, and close connection.'
  },

  ip135: {
    focus: 'A playful over-clothes lap sit that keeps the heat light, teasing, and low-pressure. One partner sits in the other’s lap while both stay clothed or mostly clothed, letting closeness, flirtation, and anticipation carry the moment.',
    benefits: 'This position creates spark without needing to move quickly into anything explicit. It can be a fun bridge between affection and desire, especially when couples want playfulness more than intensity.',
    makeItHotter: 'Use eye contact, teasing compliments, slow shifting, or a timed pause to build anticipation. The point is to let the closeness feel charged while keeping the mood playful.',
    comfort: 'Choose a stable seat and keep both partners supported. If the lap position feels crowded, shift sideways or let one partner keep feet grounded for balance.',
    whyPeopleLikeIt: 'It feels flirty and accessible. Many couples like it because it creates desire through anticipation instead of pressure.',
    shortSummary: 'A playful over-clothes lap position for teasing closeness, flirtation, and light spark.'
  },

  ip136: {
    focus: 'A standing kiss hold that turns a simple upright embrace into a playful dare. The bodies stay close, hands have room to explore, and the position can stay innocent, flirty, or become more charged depending on the moment.',
    benefits: 'The standing shape creates energy without requiring a complicated setup. It works well for couples who want something spontaneous, kiss-centered, and easy to move into from everyday closeness.',
    makeItHotter: 'Set a playful rule, like holding the kiss for a certain number of breaths or keeping hands only at the waist. The light restraint can make the simple hold feel more exciting.',
    comfort: 'Use a wall, counter, or doorframe nearby if balance becomes an issue. Keep knees soft and avoid leaning so far that either partner has to brace.',
    whyPeopleLikeIt: 'It feels spontaneous and fun. Many people like it because standing closeness can turn an ordinary moment into something charged quickly.',
    shortSummary: 'A standing kiss hold with playful dare energy, close contact, and easy spontaneity.'
  },

  ip137: {
    focus: 'A turnaround riding position that changes direction and perspective while keeping the partner on top in control. The movement can feel confident and playful because the shift itself adds novelty before anything else changes.',
    benefits: 'Changing orientation can make a familiar riding position feel completely different. It gives the top partner more ways to explore angle, posture, and confidence while the lower partner stays grounded and supportive.',
    makeItHotter: 'Let the turn be slow and intentional. Pause after switching direction, reset the hands for balance, and let the new view change the mood before adding pace.',
    comfort: 'Use hands on thighs, bed, or the partner’s body for balance. If knees or thighs tire, lean forward, pause, or switch back to a more supported posture.',
    whyPeopleLikeIt: 'It feels confident and novel. Many couples like it because a simple turn can create a new mood without needing a whole new position.',
    shortSummary: 'A turnaround riding position that adds novelty, top-partner control, and playful confidence.'
  },

  ip138: {
    focus: 'A playful lap straddle that keeps the energy light, close, and a little silly. One partner sits while the other straddles them face-to-face, letting laughter, touch, and small movements guide the moment.',
    benefits: 'The lap position offers closeness while the playful tone keeps things from feeling too serious or performance-heavy. It is good for couples who want intimacy to feel warm, flirty, and emotionally easy.',
    makeItHotter: 'Let humor and desire exist together. A playful challenge, whispered compliment, or slow shift from laughter into eye contact can make the position feel more charged.',
    comfort: 'Support the seated partner’s back and keep the top partner’s knees or feet grounded. Add pillows if the lap height or hip angle feels awkward.',
    whyPeopleLikeIt: 'It feels fun and connected. Many people like it because the position allows laughter and sensuality to share the same space.',
    shortSummary: 'A playful face-to-face lap straddle for laughter, closeness, and flirty physical connection.'
  },

  ip139: {
    focus: 'An edge-of-couch play position that uses the furniture to create a casual, flirtatious setup. One partner sits or reclines near the couch edge while the other comes close, turning the living room into a more intentional space.',
    benefits: 'The couch makes the position feel accessible and spontaneous. It gives enough support for comfort while keeping the energy playful, casual, and less formal than a bedroom setup.',
    makeItHotter: 'Use the edge of the couch as the anchor. Shift closer, change the seated angle, or add a playful rule like no rushing or only slow kisses.',
    comfort: 'Make sure the couch edge supports both bodies without sliding. Add a cushion behind the back or under the knees if the position starts to feel unstable.',
    whyPeopleLikeIt: 'It feels casual and teasing. Many couples like it because it turns an ordinary couch moment into something more flirtatious.',
    shortSummary: 'A playful edge-of-couch position for casual heat, support, and flirty closeness.'
  },

  ip140: {
    focus: 'A flirty chair sit that creates a small, intimate stage for teasing, closeness, and eye contact. One partner sits while the other settles near or in their lap, letting the chair make the moment feel contained and focused.',
    benefits: 'The chair gives structure and makes the position feel deliberate without being complicated. It is good for playful attention, slow kissing, and letting one partner feel watched, chosen, or invited closer.',
    makeItHotter: 'Use the chair as part of the flirtation. Have one partner invite the other closer, pause before contact, or keep the rhythm limited to slow shifts and eye contact.',
    comfort: 'Choose a stable chair with enough room to sit safely. If the seat is hard, add a cushion, and avoid positions where either partner’s knees or lower back feel unsupported.',
    whyPeopleLikeIt: 'It feels playful and direct. Many people like it because the chair creates a focused little space for flirtation and attention.',
    shortSummary: 'A flirty chair-based position for teasing closeness, eye contact, and playful invitation.'
  },

  ip141: {
    focus: 'A guided touch challenge where partners turn touch into a playful game. The position can be seated, side-lying, or reclined, but the focus is on taking turns guiding attention through simple prompts and responses.',
    benefits: 'The game structure makes communication easier and less awkward. It gives partners permission to ask, guide, pause, and respond while keeping the mood light and curious.',
    makeItHotter: 'Use a timer, cards, or simple prompts like softer, slower, warmer, closer, or pause. The playful structure can make the touch feel more intentional.',
    comfort: 'Keep the setup low-effort so the game does not become physically distracting. Choose a position where both partners can reach comfortably and relax between turns.',
    whyPeopleLikeIt: 'It feels playful and communicative. Many couples like it because the challenge turns feedback into something fun instead of serious.',
    shortSummary: 'A guided touch game that makes communication playful, curious, and body-aware.'
  },

  ip142: {
    focus: 'A taking-turns position where leadership passes between partners. One partner guides pace, touch, or posture for a while, then the other takes over, creating a sense of mutual confidence and playful exchange.',
    benefits: 'Switching leadership helps both partners feel involved and desired. It can reveal preferences naturally because each person gets a chance to show what they like, not just describe it.',
    makeItHotter: 'Set a simple turn length, like one song or two minutes. When leadership switches, change only one thing at a time: pace, hand placement, pressure, or closeness.',
    comfort: 'Leadership should stay consensual and responsive. If either partner feels unsure, use smaller choices and make it easy to pause or switch back.',
    whyPeopleLikeIt: 'It feels mutual and alive. Many people like it because taking turns creates variety while keeping both partners actively engaged.',
    shortSummary: 'A lead-switching position where partners take turns guiding pace, touch, and closeness.'
  },

  ip143: {
    focus: 'A blindfolded touch position centered on trust, anticipation, and careful attention. One partner limits sight while the other uses slow, clear touch to create a sense of surprise without losing safety.',
    benefits: 'Removing sight can make small touches feel more noticeable and emotionally charged. The position works best when consent and communication are strong, making the surprise feel cared for rather than uncertain.',
    makeItHotter: 'Keep the touch slow and predictable at first, then add small variations in pressure, temperature, or location. A check-in phrase can keep the experience safe while still feeling exciting.',
    comfort: 'Use only a soft, easy-to-remove blindfold and agree on a clear pause word or signal. Keep the receiving partner physically supported so they do not feel off-balance or exposed in a bad way.',
    whyPeopleLikeIt: 'It feels anticipatory and trust-building. Many couples like it because limited sight can make touch feel more vivid and intentional.',
    shortSummary: 'A blindfolded touch position for anticipation, trust, and slow sensory attention.'
  },

  ip144: {
    focus: 'A quick standing hold with playful spark and short-burst energy. The partners come together upright, using a wall, counter, or close embrace for support while the moment stays brief, flirty, and energized.',
    benefits: 'This position is useful when couples want a flash of connection rather than a long setup. It brings heat into a small window of time and can make desire feel spontaneous and alive.',
    makeItHotter: 'Keep it short on purpose. A timer, a whispered dare, or one clear rule can make the quickness feel playful instead of rushed.',
    comfort: 'Use a sturdy surface for balance and keep both feet grounded at first. If the position starts to feel unstable, shift into a seated or wall-supported version.',
    whyPeopleLikeIt: 'It feels spontaneous and exciting. Many people like it because the position creates energy quickly without needing a long scene.',
    shortSummary: 'A quick standing hold for playful spark, brief heat, and spontaneous closeness.'
  },

  ip145: {
    focus: 'A playful bed tangle that begins with laughter, movement, and soft chaos. Partners roll, cuddle, tease, or wrestle lightly until the bodies naturally settle into closeness.',
    benefits: 'This position keeps intimacy from feeling too serious. It is especially good for couples who connect through humor, physical play, and the feeling of being relaxed enough to be silly together.',
    makeItHotter: 'Let the playful energy slowly narrow into eye contact or a close hold. The shift from laughter into desire can make the moment feel surprisingly charged.',
    comfort: 'Keep the play gentle and avoid pressure on joints, necks, or backs. Use a soft surface and pause quickly if either partner feels overwhelmed or pinned.',
    whyPeopleLikeIt: 'It feels lighthearted and affectionate. Many couples like it because play can lower pressure and make closeness feel more natural.',
    shortSummary: 'A playful bed-tangle position that turns laughter, teasing, and soft chaos into closeness.'
  },

  ip146: {
    focus: 'A side-by-side teasing position where partners stay relaxed while touch, words, and small movements build flirtation. It is low-effort but not passive, with both partners able to guide the mood.',
    benefits: 'The side-by-side setup makes teasing feel accessible and comfortable. It gives room for slow touch, whispered comments, playful denial, or gentle invitation without a high-energy position.',
    makeItHotter: 'Use pacing as the tease: pause, repeat, move closer, then soften. Small shifts can feel more powerful when the bodies are already relaxed.',
    comfort: 'Support heads, shoulders, and knees so both partners can stay comfortable. If side-by-side reach feels awkward, angle the bodies slightly toward each other.',
    whyPeopleLikeIt: 'It feels relaxed and flirtatious. Many people like it because the position can stay comfortable while still creating anticipation.',
    shortSummary: 'A side-by-side teasing position for low-effort flirtation, touch, and playful anticipation.'
  },

  ip147: {
    focus: 'A slow angle-changing position where partners rotate or shift through a few variations instead of staying fixed. The movement between angles becomes part of the experience, creating curiosity and momentum.',
    benefits: 'Changing angles slowly helps couples discover what feels best without needing abrupt transitions. It makes the position feel exploratory while still staying controlled and connected.',
    makeItHotter: 'Choose three angles and move through them slowly. Pause at each one long enough to notice what changed before deciding whether to stay or keep moving.',
    comfort: 'Move gradually and support the body during transitions. If an angle feels awkward, back out gently rather than pushing through.',
    whyPeopleLikeIt: 'It feels curious and responsive. Many couples like it because the position turns experimentation into a slow, shared process.',
    shortSummary: 'A slow angle-changing position for exploration, curiosity, and controlled transitions.'
  },

  ip148: {
    focus: 'A one-partner-leads position where attention centers on being guided with care. The leading partner sets pace, touch, or posture while the receiving partner stays responsive, making the dynamic feel focused and trust-based.',
    benefits: 'Clear leadership can feel exciting when it is consensual and attentive. It gives the moment a strong shape while still leaving room for feedback, pauses, and adjustment.',
    makeItHotter: 'Let the leading partner choose one element at a time: rhythm, hand placement, closeness, or stillness. Keeping the choices simple makes the dynamic feel confident rather than overwhelming.',
    comfort: 'Agree on an easy pause or change signal before beginning. The lead should feel attentive and responsive, not rigid or one-sided.',
    whyPeopleLikeIt: 'It feels focused and confidence-building. Many people like it because being guided can feel freeing when trust is already present.',
    shortSummary: 'A one-partner-leads position built around attentive guidance, trust, and clear focus.'
  },

  ip149: {
    focus: 'A tickle-to-kiss hold that uses laughter as the doorway into closeness. The position begins playfully, then settles into a kiss, cuddle, or soft hold once both partners are smiling and relaxed.',
    benefits: 'Play can make intimacy feel less pressured and more emotionally accessible. This position works well for couples who like affection to start with humor before becoming tender or sensual.',
    makeItHotter: 'Let the shift from laughter to stillness happen slowly. A playful pause, close eye contact, or sudden soft kiss can make the transition feel charged.',
    comfort: 'Only use tickling if both partners genuinely enjoy it. Keep the touch light, avoid sensitive areas that feel overwhelming, and stop immediately if the play stops being fun.',
    whyPeopleLikeIt: 'It feels sweet and disarming. Many couples like it because laughter can make the body relax and open into closeness.',
    shortSummary: 'A playful tickle-to-kiss hold that turns laughter into soft, affectionate intimacy.'
  },

  ip150: {
    focus: 'A hidden-touch cuddle where the bodies stay close and relaxed while one partner offers subtle, private touch. The position feels cozy and secretive, with the focus on small contact rather than dramatic movement.',
    benefits: 'This position can create a sense of playful intimacy without needing a high-energy setup. It works well when partners want closeness that feels private, teasing, and contained.',
    makeItHotter: 'Keep the touch slow and subtle. A hand under a blanket, a whispered cue, or a repeated light touch can make the cuddle feel more charged.',
    comfort: 'Stay aware of temperature, pressure, and body position. If the hidden touch makes either partner feel crowded or overstimulated, shift into a more open cuddle.',
    whyPeopleLikeIt: 'It feels private and playful. Many people like it because small touches can create a lot of anticipation inside an otherwise cozy hold.',
    shortSummary: 'A hidden-touch cuddle that feels cozy, private, and quietly teasing.'
  },

  ip151: {
    focus: 'A standing sway that blends dancing, hugging, and slow physical rhythm. The bodies stay upright and close while the movement comes from gentle swaying instead of structured steps.',
    benefits: 'The dance-like shape makes intimacy feel romantic and playful without requiring performance. It works well as a transition from everyday closeness into something warmer.',
    makeItHotter: 'Choose one song and stay close through the whole track. A hand at the lower back, cheek, or waist can make the sway feel more intentional.',
    comfort: 'Keep knees soft and feet grounded. If standing gets tiring, move the same sway into a seated lap hold or couch embrace.',
    whyPeopleLikeIt: 'It feels romantic and easy. Many couples like it because the slow dance energy creates closeness without needing a complicated position.',
    shortSummary: 'A standing sway position that blends slow dancing, hugging, and romantic closeness.'
  }
};

const missing = [];
let changed = 0;

for (const [id, patch] of Object.entries(patches)) {
  const item = data.items.find((position) => position.id === id);

  if (!item) {
    missing.push(id);
    continue;
  }

  Object.assign(item, patch);
  changed += 1;
}

if (missing.length > 0) {
  throw new Error(`Missing position ids: ${missing.join(', ')}`);
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

console.log(`Rewrote ${changed} intimacy position copy entries.`);

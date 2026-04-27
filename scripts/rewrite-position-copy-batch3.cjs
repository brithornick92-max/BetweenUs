const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/intimacy-positions.json must have an items array');
}

const patches = {
  ip102: {
    focus: 'A sofa-based seated closeness position that feels warm, familiar, and easy to settle into. One partner sits supported while the other comes close in their lap or against their body, turning an ordinary couch moment into something more intimate and intentional.',
    benefits: 'The sofa gives both partners support without making the position feel overly structured. It works well for couples who want face-to-face warmth, low-pressure touch, and a position that can move naturally between cuddling, kissing, and slow rhythm.',
    makeItHotter: 'Use the back of the couch for support and let the closeness build slowly. A hand at the waist, lower back, or thigh can guide the rhythm while keeping the mood relaxed and personal.',
    comfort: 'Choose a couch spot with enough back support and room for both partners to settle. Add a pillow under the knees or behind the lower back if either person starts holding tension.',
    whyPeopleLikeIt: 'It feels intimate without needing a special setup. Many couples like it because it turns a familiar living-room position into something affectionate, close, and easy to sustain.',
    shortSummary: 'A supported sofa closeness position that feels warm, familiar, and easy to stay in.'
  },

  ip103: {
    focus: 'A side-spooning position with knee support that keeps the body wrapped and relaxed. The pillow or blanket between the knees helps the hips stay comfortable while the partners remain close through the back, waist, and legs.',
    benefits: 'This position is especially good for low-energy closeness because it reduces strain while preserving full-body contact. The support makes the shape easier to hold, which lets both partners focus on warmth and slow rhythm instead of adjusting constantly.',
    makeItHotter: 'Keep the hips close while letting the upper body stay soft. A hand over the stomach, chest, or thigh can make the spooning shape feel more attentive and connected.',
    comfort: 'Use a folded blanket or pillow between the knees and adjust it until the hips feel level. If the front partner feels crowded, create more space at the chest while keeping one point of contact at the hips or waist.',
    whyPeopleLikeIt: 'It feels cozy, stable, and body-friendly. Many people like it because the added knee support makes spooning easier to relax into for longer stretches.',
    shortSummary: 'A supported spooning variation with knee cushioning for cozy, low-effort closeness.'
  },

  ip104: {
    focus: 'A whispering hold for couples who want intimacy to feel quiet, close, and emotionally private. The bodies stay near enough for soft words, breath, and small touches to become part of the position itself.',
    benefits: 'The whispering element naturally slows the moment down and makes the closeness feel personal. It can be tender, playful, or vulnerable depending on what partners choose to say, but the shape remains simple and supported.',
    makeItHotter: 'Keep voices low and use short phrases rather than long conversations. A whispered compliment, request, or reassurance can make the hold feel more charged without changing the position.',
    comfort: 'Choose a side-lying, seated, or reclined setup where both necks can stay relaxed. If whispering near the ear feels too intense, shift to forehead closeness or cheek-to-cheek contact.',
    whyPeopleLikeIt: 'It feels private and emotionally close. Many couples like it because the position makes simple words feel more intimate and connected to the body.',
    shortSummary: 'A quiet close hold where whispered words, breath, and touch become the center.'
  },

  ip105: {
    focus: 'An edge-recline position with a gentle pace and a clear, supported angle. One partner reclines near the edge while the other comes close from the front, creating enough structure for rhythm without making the position feel intense or athletic.',
    benefits: 'The edge helps set the angle while the slower pace keeps the position approachable. It can feel sensual and precise without requiring much movement, making it useful for couples who want steadiness over speed.',
    makeItHotter: 'Adjust the distance from the edge slowly and notice what changes. A hand at the thigh, hip, or waist can make the position feel guided, while long pauses can make the angle feel more intentional.',
    comfort: 'Make sure the surface edge is padded and the height works for both partners. If the reclining partner feels too open or stretched, bend the knees more or lower the legs.',
    whyPeopleLikeIt: 'It feels controlled and easy to personalize. Many people like it because the edge gives support while still creating a more focused angle than lying flat.',
    shortSummary: 'A gentle edge-recline position with a supported angle and slow, steady rhythm.'
  },

  ip106: {
    focus: 'A low-effort full-contact position for moments when closeness matters more than movement. The bodies stay supported and pressed together in a way that feels restful, warm, and emotionally easy.',
    benefits: 'This position works well when partners are tired, tender, or wanting comfort without a complicated setup. It keeps the connection physical and present while allowing both bodies to stay mostly relaxed.',
    makeItHotter: 'Use pressure instead of pace. A firmer hold, slower breath, or small shift through the hips can make the full contact feel more intimate without adding effort.',
    comfort: 'Choose a version where both partners can breathe and relax. If the pressure feels too heavy, move slightly side-by-side or use pillows to distribute weight more evenly.',
    whyPeopleLikeIt: 'It feels simple and reassuring. Many couples like it because it allows intimacy to stay close and physical without demanding energy that may not be there.',
    shortSummary: 'A low-effort full-contact position for warm, restful, body-close intimacy.'
  },

  ip107: {
    focus: 'A loose leg-tangle position that creates connection without locking either partner into place. The legs weave lightly together while the upper bodies stay free to cuddle, kiss, talk, or rest.',
    benefits: 'The gentle tangle adds a feeling of being linked while keeping the position flexible. It is useful when partners want a little more physical connection than side-by-side lying, but do not want anything rigid or demanding.',
    makeItHotter: 'Let the legs become a subtle signal. Hook closer for more contact, release slightly for breath, or press gently during a kiss or pause.',
    comfort: 'Avoid tightening the legs around joints or forcing an angle. If knees or hips feel crowded, loosen the tangle and rebuild it with less overlap.',
    whyPeopleLikeIt: 'It feels casual and intimate at the same time. Many people like it because the loose leg contact adds connection without making the body feel trapped.',
    shortSummary: 'A gentle leg-tangle position that feels linked, flexible, and easy to soften.'
  },

  ip108: {
    focus: 'A soft hip-rocking position where rhythm stays smooth and close rather than fast or forceful. The movement comes from small sways through the hips, making the position feel sensual, steady, and easy to follow.',
    benefits: 'This position helps couples focus on rhythm as a shared experience. It can make small movement feel satisfying because the bodies stay connected and the pace remains controlled.',
    makeItHotter: 'Let one partner guide the sway with hands at the hips or lower back. Slowing the rhythm and holding pressure for a moment can make the movement feel stronger without speeding up.',
    comfort: 'Support the lower back, knees, or wrists depending on the shape you choose. If the rocking starts to feel like work, reduce the range and return to smaller movement.',
    whyPeopleLikeIt: 'It feels smooth and connected. Many couples like it because the rhythm is easy to adjust and does not require athletic effort to feel sensual.',
    shortSummary: 'A soft hip-rocking position built around smooth shared rhythm and close contact.'
  },

  ip109: {
    focus: 'A sleepy spooning position for warm, drowsy intimacy. The bodies stay nested and relaxed, with the rhythm kept small enough that the moment can feel almost like cuddling with a little extra heat.',
    benefits: 'This position is useful when partners want intimacy without fully waking up or shifting into high energy. It keeps the connection cozy and low-pressure while still allowing sensual closeness.',
    makeItHotter: 'Stay under the blanket and let the heat build slowly. A hand at the waist or thigh, a soft kiss on the shoulder, or a closer pull through the hips can make the sleepy mood feel more charged.',
    comfort: 'Use pillows between the knees and under the head so side-lying stays easy. If either partner starts to feel cramped, loosen the spoon and keep only one grounding point of contact.',
    whyPeopleLikeIt: 'It feels natural and unforced. Many people like it because it lets intimacy happen inside a sleepy, affectionate cuddle instead of requiring a full reset.',
    shortSummary: 'A sleepy spooning position for drowsy warmth, small movement, and cozy closeness.'
  },

  ip110: {
    focus: 'A quiet side-recline position for soft connection with minimal effort. Partners settle beside or slightly into each other, using the reclined angle to keep the body relaxed while staying physically close.',
    benefits: 'The side recline can feel easier than fully face-to-face or fully behind-the-body positions. It allows touch, kissing, and small rhythm while keeping the posture restful and flexible.',
    makeItHotter: 'Bring the hips slightly closer while keeping shoulders and neck relaxed. A hand at the back, waist, or thigh can guide the closeness without making the position feel busy.',
    comfort: 'Support the upper body with pillows and avoid twisting through the spine. If one partner feels like they are reaching, shift the whole body closer rather than stretching one limb.',
    whyPeopleLikeIt: 'It feels calm and adaptable. Many couples like it because it can stay affectionate, sensual, or restful depending on the energy of the night.',
    shortSummary: 'A quiet side-recline position for soft, adaptable, low-effort intimacy.'
  },

  ip111: {
    focus: 'A chest-to-back stillness position where one partner holds the other from behind and both settle into the same breath. The shape is quiet, protective, and trust-centered, with almost no movement required.',
    benefits: 'The stillness can make the hold feel emotionally grounding. It gives the front partner a sense of being supported while the partner behind stays connected through warmth, breath, and steady contact.',
    makeItHotter: 'Let the stillness last before adding touch. A hand over the heart, stomach, or thigh can make the held feeling more intimate while preserving the calm.',
    comfort: 'Keep the hold soft enough that the front partner can breathe freely. Use pillows under the head or knees if side-lying, or sit against a wall if seated support feels better.',
    whyPeopleLikeIt: 'It feels safe and regulating. Many people like it because the behind-the-body hold creates closeness without requiring performance or intensity.',
    shortSummary: 'A chest-to-back stillness hold for quiet trust, breath, and protective closeness.'
  },

  ip112: {
    focus: 'An angled missionary variation that shifts the bodies slightly off-center to find a more precise line of contact. The position stays familiar and face-to-face, but the diagonal alignment makes it feel newly focused.',
    benefits: 'A small angle change can make a familiar position feel much more responsive. This variation gives couples a simple way to explore sensation without changing the emotional tone of face-to-face closeness.',
    makeItHotter: 'Move the hips a few inches to one side and test the difference before changing pace. A pillow under one hip can help hold the angle without requiring extra effort.',
    comfort: 'Keep the shoulders and spine relaxed rather than twisting the whole body. If the angle feels uneven, return to center and try a smaller shift.',
    whyPeopleLikeIt: 'It feels familiar but refreshed. Many couples like it because tiny angle changes can create a different sensation without requiring a complicated position.',
    shortSummary: 'A slightly angled missionary variation that adds precision while staying face-to-face.'
  },

  ip113: {
    focus: 'A hip-pillow lift that raises the pelvis just enough to change the angle while keeping the receiving partner supported. The shape is simple, focused, and easy to personalize with pillow height.',
    benefits: 'The pillow lift can make the position feel more comfortable and more direct at the same time. It reduces the need for active arching while helping both partners find a clearer line of contact.',
    makeItHotter: 'Try one pillow first, then adjust height slowly. Staying close and slowing the rhythm can make the lifted angle feel more intense without adding speed.',
    comfort: 'The lower back should feel supported, not forced upward. If the lift creates pressure, use a flatter pillow or place support under the knees as well.',
    whyPeopleLikeIt: 'It feels easy and effective. Many people like it because one small support change can noticeably improve comfort, angle, and closeness.',
    shortSummary: 'A hip-pillow lift that creates a clearer angle while keeping the body supported.'
  },

  ip114: {
    focus: 'A circular hip-rhythm position that uses spirals, figure-eights, and slow circles to create a more fluid sensation. The movement stays controlled and body-led, making the rhythm feel exploratory without becoming chaotic.',
    benefits: 'Circular movement can unlock a different kind of sensation than straight movement. It gives partners room to discover pressure, direction, and pace while staying connected and responsive.',
    makeItHotter: 'Keep the circles smaller than expected at first. Change direction, pause at the strongest point, or move from circles into a slow forward-back rhythm when the body finds a good path.',
    comfort: 'Use hand or elbow support so the hips can move without the whole body straining. If the circles feel awkward, reduce the range until the motion feels natural.',
    whyPeopleLikeIt: 'It feels fluid and customizable. Many couples like it because the motion can be shaped moment by moment instead of locked into one rhythm.',
    shortSummary: 'A circular hip-rhythm position for fluid, exploratory, body-led movement.'
  },

  ip115: {
    focus: 'A prone pillow-supported position that keeps the body low while adding enough lift to create a better angle. The shape feels grounded and warm, with the pillow doing the work that the lower back would otherwise have to do.',
    benefits: 'The support helps the receiving partner relax into the surface while keeping the position connected from behind. It can make prone closeness feel easier, softer, and more sustainable.',
    makeItHotter: 'Stay low and close rather than lifting away. A hand on the back, waist, or hip can make the position feel more held, and small pillow adjustments can shift the sensation quickly.',
    comfort: 'Use a pillow height that supports without over-arching. If breathing or lower-back comfort changes, lower the support and create more room through the chest.',
    whyPeopleLikeIt: 'It feels grounded and supported. Many people like it because the pillow creates angle without taking away the low, body-close feeling.',
    shortSummary: 'A prone pillow-supported position that feels grounded, warm, and easier on the body.'
  },

  ip116: {
    focus: 'A one-leg-lifted position that creates a stronger angle while keeping the overall setup simple. One leg stays grounded or relaxed while the other lifts, giving the position a focused, asymmetrical shape.',
    benefits: 'Lifting one leg can add intensity without requiring the full flexibility of both legs raised. It lets both partners experiment with angle, depth, and closeness while staying face-to-face or near face-to-face.',
    makeItHotter: 'Support the lifted leg with a hand, shoulder, or pillow and adjust the height slowly. Lowering the leg slightly can sometimes make the position feel better than raising it higher.',
    comfort: 'Do not force the lifted leg into a stretch. If the hip, hamstring, or lower back feels strained, bend the knee more or rest the leg lower.',
    whyPeopleLikeIt: 'It feels direct and adjustable. Many couples like it because one leg shift can change the entire position without needing a complex setup.',
    shortSummary: 'A one-leg-lifted position that creates a focused angle while staying simple and adjustable.'
  },

  ip117: {
    focus: 'A reclined hip-elevation position that uses lift to create a more open, focused angle. The receiving partner stays supported while the partner above or in front can come close with steadier alignment.',
    benefits: 'The elevation can make the position feel clearer and more controlled without requiring active effort from the receiving partner. It is useful when couples want a stronger angle but still want the body to feel held.',
    makeItHotter: 'Use the lift to slow down and stay precise. A hand at the hips or thighs can help guide the angle while pauses make the elevated position feel more intentional.',
    comfort: 'Support the hips evenly and avoid stacking the pelvis too high. If the lower back feels pinched, reduce the height or add support under the knees.',
    whyPeopleLikeIt: 'It feels supported and focused. Many people like it because the elevation changes the sensation while keeping the setup stable.',
    shortSummary: 'A reclined hip-elevation position for supported lift, open angle, and steady contact.'
  },

  ip118: {
    focus: 'A straight-leg missionary variation that changes the feel by lengthening the body instead of bending or wrapping the legs. The shape feels clean, close, and more contained, with sensation shaped by alignment and pressure.',
    benefits: 'Keeping the legs straighter can shift contact in a subtle but noticeable way. It offers a quieter alternative to more open positions while keeping the emotional tone face-to-face and connected.',
    makeItHotter: 'Keep the bodies close and experiment with tiny changes in hip tilt. A slower pace usually makes the straight-leg alignment feel more intentional and focused.',
    comfort: 'If the hamstrings or lower back feel tight, soften the knees slightly or place a pillow under them. The legs do not need to be perfectly straight to create the effect.',
    whyPeopleLikeIt: 'It feels simple and controlled. Many couples like it because the position changes sensation through alignment rather than complexity.',
    shortSummary: 'A straight-leg face-to-face variation that feels contained, close, and subtly focused.'
  },

  ip119: {
    focus: 'A pendulum-style rhythm where the bodies move slowly forward and back in a steady, repeating pattern. The position is less about changing shapes and more about finding a reliable, soothing rhythm together.',
    benefits: 'The forward-back motion is easy to understand and easy to adjust. It can create a calm sensual pace that helps both partners stay synchronized without needing a lot of instruction.',
    makeItHotter: 'Let the rhythm become predictable, then change one detail: pause at the closest point, slow the return, or add firmer pressure through the hips.',
    comfort: 'Keep the range of motion small enough that neither partner has to brace. Use pillows or hand support if the rhythm starts pulling on the lower back or hips.',
    whyPeopleLikeIt: 'It feels steady and satisfying. Many people like it because the simple rhythm creates a shared pace that is easy to settle into.',
    shortSummary: 'A forward-back rhythm position that feels steady, synchronized, and easy to follow.'
  },

  ip120: {
    focus: 'An alternating-pace position where the rhythm intentionally shifts between slower, steadier, and more charged moments. The position itself can stay simple while the pacing creates variety and anticipation.',
    benefits: 'Changing pace gives partners a way to explore intensity without constantly changing positions. It can make a familiar setup feel more responsive because both partners pay attention to timing, pauses, and return.',
    makeItHotter: 'Agree on a simple pattern, like slow-slow-pause or slow-build-slow. The contrast between restraint and momentum can make the position feel more intense than speed alone.',
    comfort: 'Keep communication clear so pace changes feel exciting, not surprising in a bad way. If the body starts tensing, return to the slowest rhythm and reset.',
    whyPeopleLikeIt: 'It feels dynamic without being complicated. Many couples like it because pacing alone can change the whole mood of a familiar position.',
    shortSummary: 'An alternating-pace position that uses timing, pause, and contrast to build intensity.'
  },

  ip121: {
    focus: 'A guided-rhythm hold where one partner helps shape the pace with hands at the waist, hips, lower back, or thighs. The position centers communication through touch, making the rhythm feel shared instead of guessed.',
    benefits: 'Guided touch can make the experience feel more connected and less uncertain. It gives both partners a clear way to communicate what feels good, what should slow down, and when to stay close.',
    makeItHotter: 'Let the guiding hands become part of the intimacy. A firmer hold, slower pull, or still pause can make the rhythm feel intentional and charged.',
    comfort: 'Guidance should feel supportive, not controlling. Check pressure at the hips or waist, and adjust hand placement if anything feels tense or restrictive.',
    whyPeopleLikeIt: 'It feels responsive and collaborative. Many people like it because the hands create a shared language for pace and closeness.',
    shortSummary: 'A guided-rhythm position where hands help shape pace, pressure, and connection.'
  },

  ip122: {
    focus: 'A low grinding rhythm that keeps the bodies close and the movement compact. Rather than creating distance, partners stay pressed near each other and use slow pressure through the hips to build sensation.',
    benefits: 'The low movement can make the position feel sensual and controlled. It is especially useful when couples want intensity from pressure and closeness rather than speed.',
    makeItHotter: 'Keep the grind slow and consistent. A slight hip tilt, firmer hold, or longer pause at the deepest contact point can make the rhythm feel stronger.',
    comfort: 'Use support under knees, hips, or wrists depending on the position. If friction or pressure becomes too much, soften the angle or add more cushion.',
    whyPeopleLikeIt: 'It feels close and focused. Many couples like it because small grinding movement can feel powerful without needing a large range of motion.',
    shortSummary: 'A low grinding position built around close pressure, compact rhythm, and sensual control.'
  },

  ip123: {
    focus: 'A hip-lift support position that raises the receiving partner slightly while keeping the rest of the body grounded. The lift creates a more focused angle while hands, pillows, or the surface provide steadiness.',
    benefits: 'The supported lift can make the position feel more precise without requiring the receiving partner to hold an active bridge. It gives both partners room to adjust height, pressure, and closeness.',
    makeItHotter: 'Lift only enough to change the angle, then slow everything down. Hands at the hips or thighs can make the supported shape feel more secure and intentional.',
    comfort: 'Do not hold the hips up through muscle effort alone for long. Use pillows, hands, or a surface to share the support and lower the lift if the back starts working too hard.',
    whyPeopleLikeIt: 'It feels focused and supported. Many people like it because the lift adds intensity while still keeping the body grounded.',
    shortSummary: 'A supported hip-lift position that creates focused angle without requiring a full bridge.'
  },

  ip124: {
    focus: 'A low close missionary variation where the bodies stay near, warm, and emotionally connected. The position favors pressure and stillness over big movement, making it feel quiet, intimate, and easy to soften into.',
    benefits: 'The low setup keeps the closeness continuous and reduces the need for high energy. It works well for partners who want a familiar position that feels more tender and body-aware.',
    makeItHotter: 'Stay low through the chest and use tiny hip shifts instead of pulling away. A hand at the face, waist, or back can make the closeness feel more deliberate.',
    comfort: 'Support the partner above through forearms or elbows so the lower partner can breathe easily. If the pressure feels too heavy, create a little space at the chest while keeping the hips close.',
    whyPeopleLikeIt: 'It feels intimate and grounded. Many couples like it because the position keeps the familiar face-to-face shape but makes it slower and more connected.',
    shortSummary: 'A low close missionary variation for quiet pressure, warmth, and emotional connection.'
  },

  ip125: {
    focus: 'A tabletop recline that creates a clean, elevated angle with one partner supported by a sturdy surface. The partner in front can come close while the surface handles much of the height and structure.',
    benefits: 'The elevated surface makes the position feel more open and direct without requiring a full lift. It can feel adventurous while still being practical, especially when the height fits both partners well.',
    makeItHotter: 'Use the edge of the surface to set the angle, then bring the hips closer before adding pace. A hand at the thighs or waist can make the position feel more guided and secure.',
    comfort: 'Only use a surface that is stable, comfortable, and the right height. Add a towel or blanket under the reclining partner if the edge feels hard.',
    whyPeopleLikeIt: 'It feels bold but structured. Many people like it because the surface creates lift and openness while keeping the position supported.',
    shortSummary: 'A tabletop recline with an elevated angle, sturdy support, and a more adventurous feel.'
  },

  ip126: {
    focus: 'A pillow-under-hips position that gives a familiar setup a clearer, more supported angle. The pillow changes the line of contact while helping the receiving partner stay relaxed instead of arching or bracing.',
    benefits: 'This is one of the simplest ways to make a position feel more comfortable and more focused. It allows both partners to experiment with lift and pressure while keeping the overall shape familiar.',
    makeItHotter: 'Start with one pillow and let the lifted angle do the work. Slow the pace, stay close, and adjust height by small amounts until the sensation feels right.',
    comfort: 'If the lower back feels pinched, reduce the pillow height or add support beneath the knees. The lift should feel easy to rest into, not like a forced arch.',
    whyPeopleLikeIt: 'It feels practical and effective. Many couples like it because one small support change can make the whole position feel more tuned to their bodies.',
    shortSummary: 'A pillow-under-hips position that adds supported lift, clearer angle, and familiar closeness.'
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

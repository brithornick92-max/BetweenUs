const fs = require('fs');

const targetPath = process.argv[2] || './content/intimacy-positions.json';

if (!fs.existsSync(targetPath)) {
  console.error(`Could not find file: ${targetPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const items = data.items || [];

const howToUpdates = {
  ip102:
    'One partner sits or reclines on a couch with their back supported by cushions while the other settles close beside them, across their lap, or facing them. Use the couch back, armrest, or pillows to create a comfortable base before adding movement. The partner being held can relax into the support while the other keeps hands at the waist, back, thigh, or hips. Start as a warm seated cuddle, then let the closeness turn into slow rocking or guided touch if both partners want more.',

  ip103:
    'Both partners lie in a spooning position with a pillow between the knees or tucked under the front partner’s top leg. The partner behind curls close, adjusting chest and hip contact separately so the hold feels secure without being too tight. The pillow keeps the hips and lower back more comfortable, especially if side-lying usually feels cramped. Begin with stillness, then add small slow movements through the hips while keeping the upper bodies relaxed and wrapped together.',

  ip104:
    'Choose a close position where whispering feels natural, such as spooning, face-to-face side-lying, or one partner sitting in the other’s lap. Bring the faces close enough that one partner can speak softly near the ear, cheek, or neck without straining. Hands can rest at the waist, back, face, or thigh while the bodies stay mostly still. Let the words, breath, and tiny shifts in closeness lead the moment before adding any stronger movement.',

  ip105:
    'One partner reclines near the edge of the bed with pillows behind the back or under the hips while the other kneels or stands close between their legs. Keep the reclining partner supported enough that they do not need to brace hard through the wrists or shoulders. The standing or kneeling partner can hold the thighs, waist, or hips to guide distance and angle. Start with a gentle pace and adjust the height of the pillows or the closeness to the edge before increasing intensity.',

  ip106:
    'Both partners choose a position with as much body contact and as little effort as possible, such as spooning, face-to-face lying, or one partner resting partly over the other with supported weight. Use pillows under knees, hips, shoulders, or the head so neither person has to hold tension. Hands can stay still at the waist, back, chest, or thigh. If movement happens, keep it small and grounded, letting the full-body contact do most of the work.',

  ip107:
    'Both partners lie close together and let the legs loosely overlap instead of trying to create a precise shape. One partner can slide a knee between the other’s thighs, drape a calf over a hip, or gently hook ankles. Keep the leg tangle loose enough that either person can shift easily. Once the legs feel comfortable, bring the upper bodies closer and use slow rocking, soft touch, or stillness to keep the position relaxed and connected.',

  ip108:
    'Start in a close position where the hips can move easily, such as face-to-face lying, side-lying, or one partner settled in the other’s lap. Instead of quick movement, let the hips sway slowly from side to side or forward and back. Hands can rest at the waist, lower back, or thighs to help guide the rhythm. Keep the movement soft and steady, checking that both partners feel relaxed enough to follow the same pace.',

  ip109:
    'Both partners lie in a sleepy spooning position with knees slightly bent and pillows wherever the hips, neck, or shoulders need support. The partner behind stays close, wrapping an arm around the waist, stomach, or chest. Keep the movement very small, like a slow press and release rather than a full rhythm. This works best when both partners stay relaxed, warm, and half-rested, using touch and breathing as much as movement.',

  ip110:
    'Both partners settle into a side recline, either facing each other or angled in the same direction. Support the head and knees with pillows so the hips can soften. One partner can drape a leg, rest a hand at the waist, or pull the other closer through the lower back. Begin with slow stillness, then explore small hip shifts or gentle pressure while keeping the side-lying shape calm and easy to hold.',

  ip111:
    'One partner rests with their back against the other partner’s chest, either lying down, sitting between their legs, or leaning back into them on the couch. The partner behind wraps arms around the waist, stomach, or chest and keeps the hold steady. Let both partners pause and breathe together before adding touch or movement. If the position becomes more intimate, keep the back-to-chest contact central so the front partner feels held rather than rushed.',

  ip112:
    'One partner lies back while the other settles above them in a classic face-to-face position, then both partners rotate slightly so the bodies meet at a diagonal instead of straight on. The reclining partner can shift their hips a few inches to one side or angle one knee outward to change the path of contact. The partner above supports their weight through hands or forearms while adjusting the diagonal slowly. Start with small angle changes first, then add rhythm once the alignment feels right.',

  ip113:
    'One partner lies back with a pillow under the hips or lower back to create a gentle lift. The other partner comes in close between their legs, using hands, forearms, or the bed for support. The lifted hips can make the angle more focused, so begin slowly and adjust pillow height before building pace. The reclining partner can keep knees bent, legs open, or feet planted while both partners check that the lower back feels supported.',

  ip114:
    'One partner lies back while the other settles above them in a position where the hips can move freely. Instead of moving straight forward and back, the partner leading the rhythm uses small circles, spirals, or figure-eight motions. Hands can rest on the waist, thighs, chest, or bed for balance. Keep the circles small at first and notice which direction feels best, then stay with the movement that creates the most comfortable shared rhythm.',

  ip115:
    'One partner lies on their stomach with a pillow under the hips, lower belly, or chest. The other partner settles close from behind, keeping their torso low enough to maintain a grounded, pressed-together feeling. The partner underneath can bend one knee outward or keep both legs relaxed, depending on what opens the angle comfortably. Begin with slow pressure and small movements, adjusting the pillow if the lower back or hips feel compressed.',

  ip116:
    'One partner lies back while the other comes in close above them. The reclining partner lifts one leg and rests it along the other partner’s hip, side, shoulder, or upper arm, depending on flexibility. The other leg stays bent, open, or planted for balance. The partner above supports the lifted leg gently without forcing it higher. Start slowly, then adjust the lifted leg lower or wider if the stretch feels too intense.',

  ip117:
    'One partner reclines with the hips slightly elevated on a pillow, wedge, folded blanket, or the edge of a cushion. The other partner kneels or settles between their legs, staying close enough that the lift feels supported rather than exposed. The reclining partner can rest hands at the bed, thighs, or partner’s arms for grounding. Begin by finding a comfortable hip height, then use slow movement so the elevated angle does not feel abrupt.',

  ip118:
    'One partner lies back with legs extended longer than usual or only softly bent at the knees. The other partner comes in close above them, keeping the bodies aligned and supported. Because the straighter leg position can change the angle through the hips, start slowly and let the reclining partner adjust by widening the legs, bending one knee, or adding a pillow. Keep the movement steady and controlled rather than trying to force a deep range.',

  ip119:
    'Start in a comfortable position where one partner can guide a slow forward-and-back rhythm, such as face-to-face lying, seated lap closeness, or a supported top-partner position. Keep the movement simple and consistent, like a pendulum returning to the same point. Hands can stay at the waist, hips, thighs, or back to help keep timing. Begin with a smaller motion than expected, then increase only if both partners feel relaxed and synchronized.',

  ip120:
    'Choose a position that already feels comfortable, then agree to alternate pace instead of staying at one speed. One partner can lead with a few slow movements, pause, then shift into a slightly stronger rhythm before softening again. The other partner gives feedback through hands, words, breathing, or body cues. Keep the changes intentional and easy to follow, making the position feel like a shared rhythm conversation rather than a performance.',

  ip121:
    'Start in a position where one partner can comfortably place hands at the other’s waist, hips, thighs, or lower back. The guiding partner uses gentle pressure to suggest pace, closeness, or direction, while the moving partner follows only what feels good. Check in early so the guidance feels supportive, not controlling. Begin with slow movement and let the hands become a way to communicate rhythm, pauses, and small angle changes.',

  ip122:
    'One partner lies back or sits supported while the other settles close above them in a low, body-connected position. Keep the bodies close enough that the movement comes from grinding, rocking, or pressing rather than lifting away. Hands can hold the waist, thighs, or back for balance. Start with slow, shallow movement and focus on pressure and contact. If either partner needs more space, lift the chest slightly while keeping the hips connected.',

  ip123:
    'One partner lies back and lifts their hips slightly into the other partner’s hands, a pillow, or the support of the bed. The other partner stays close and helps stabilize the hips rather than pulling or forcing the angle. The reclining partner can keep feet planted, knees bent, or legs loosely open. Begin with the hips only slightly raised, then adjust height, hand placement, and pillow support until the position feels steady.',

  ip124:
    'One partner lies back while the other comes in close above them, keeping the body low and connected. The partner above supports their weight through forearms, elbows, or hands so the lower partner can breathe comfortably. The reclining partner can keep legs bent, loosely wrapped, or open with pillows under the knees. Start with slow rocking and chest-to-chest closeness, letting the position feel intimate and grounded rather than fast or athletic.',

  ip125:
    'One partner reclines on a sturdy table, counter-height surface, or firm bed edge with hips close enough to the edge for the other partner to stand or kneel comfortably. The reclining partner can keep knees bent, legs open, or calves resting lightly around the standing partner. The standing partner holds the thighs, hips, or waist to stabilize the angle. Check the surface height first, then begin slowly so the setup feels secure.',

  ip126:
    'One partner lies back with a pillow under the hips to change the angle through the pelvis. The other partner settles close between their legs or above them, using hands, elbows, or the bed for support. The reclining partner can bend knees, plant feet, or keep legs loosely open depending on comfort. Before adding rhythm, adjust the pillow height and body distance until the lower back feels supported and the angle feels natural.',

  ip127:
    'One partner takes a comfortable position lying back, seated, or on top while the other places hands at the waist to guide closeness and rhythm. The hands should give gentle direction, not force movement. The moving partner can follow the pressure, pause, or redirect with words or touch. Start with a slow pace and use the waist hold to communicate smaller, closer, softer, or deeper movements as the position develops.',

  ip128:
    'One partner reclines with knees open comfortably and the back, hips, or head supported by pillows. The other partner settles between their legs, staying close enough to support the thighs or hips if needed. The reclining partner should feel open without feeling stretched or exposed beyond comfort. Begin with stillness and check the knee and hip angle first, then build slow rhythm while keeping the legs supported and relaxed.',

  ip129:
    'Choose a close position where the bodies can stay pressed together, such as face-to-face lying, prone closeness, or a low top-partner position. Keep the movement slow and use steady body pressure rather than speed. The partner applying more weight should support themselves with arms, knees, or the bed so the pressure feels comforting instead of overwhelming. Pause often, adjust breath and closeness, and let the pressure build gradually.',

  ip130:
    'Start in a position that feels easy to hold, then choose one steady rhythm and stay with it for a while. Hands can rest at the hips, waist, thighs, or back to help maintain timing. Avoid changing angles too quickly; instead, let both partners settle into the repeated motion. If something feels especially good, stay there rather than rushing to vary it. This position works best when consistency becomes part of the pleasure and connection.',

  ip131:
    'Both partners lie on their sides with the hips close and the upper bodies supported by pillows. One partner can place a hand at the waist or lower back while the other adjusts knees and leg placement for comfort. Use a rolling motion through the hips, like a slow wave, instead of a sharp forward movement. Keep the rhythm gentle and let the side-lying shape make the position feel easy and sustained.',

  ip132:
    'One partner lies back while the other approaches at a diagonal rather than straight between the legs. The reclining partner can shift their hips, angle one knee outward, or rest a leg along the other partner’s side to create the diagonal shape. The partner above or beside them supports with hands at the bed, waist, or thighs. Move slowly while testing the angle, because small rotations can change the sensation a lot.',

  ip133:
    'One partner reclines with hips lifted by a pillow, folded blanket, or the other partner’s hands. The lift should be comfortable enough that the lower back does not strain. The other partner stays close and supports the thighs, waist, or hips while both partners find the right angle. Begin with a small lift first, then increase support only if the reclining partner feels stable, open, and relaxed.',

  ip134:
    'One partner lies back or reclines slightly while the other settles close chest-to-chest. Keep the upper bodies connected so movement comes through a slow shared rhythm rather than distance. The partner above supports weight through arms or elbows, and the partner below can hold the back, waist, or hips. Start with breathing together, then add small rocking motions that keep the chest contact intact.',

  ip135:
    'One partner sits in a chair, on a couch, or at the edge of the bed while the other sits across their lap, beside them, or facing them over clothes. Keep the focus on closeness, teasing, and playful pressure rather than rushing to undress. Hands can rest at the waist, thighs, face, or back. Let the seated partner stay grounded and the lap partner control how close they want to be, using small shifts and pauses to build anticipation.',

  ip136:
    'Both partners stand close together and start with kissing before anything else. One partner can lean lightly against a wall, counter, or doorframe while the other steps in close. Keep feet grounded and hands at the waist, face, hips, or lower back for balance. Let the kiss guide whether the bodies stay still, sway, or press closer. This works best when the standing support feels stable and neither partner has to reach or strain.',

  ip137:
    'One partner lies back while the other starts in a riding position, then slowly changes orientation or angle when ready. The partner on top can turn partially to the side, shift their knees, or rotate their hips while using hands on the bed, thighs, or partner’s body for balance. Move through the transition slowly instead of trying to make it dramatic. Pause after each shift to check comfort before building rhythm again.',

  ip138:
    'One partner sits upright with a stable base while the other straddles their lap facing them. Keep the mood playful by starting with kisses, laughter, or a teasing pause before adding movement. The seated partner supports at the hips, waist, or lower back while the top partner uses arms around the shoulders for balance. Begin with small rocking motions and let the position stay light, close, and easy to adjust.',

  ip139:
    'One partner sits or reclines at the edge of a couch while the other settles close in front of them, beside them, or across their lap. Use the couch cushions and armrest for support so both bodies feel grounded. Hands can guide the waist, thighs, hips, or back while the couple adjusts distance. Start playfully, moving closer and farther by small amounts, then settle into the angle that feels most comfortable and connected.',

  ip140:
    'One partner sits in a sturdy chair with feet planted while the other stands close, sits across their lap, or lowers into a face-to-face seat. Keep one or both partners supported by the chair so the position feels flirty rather than physically demanding. Hands can rest on thighs, waist, shoulders, or the chair back. Start with teasing closeness, eye contact, or kissing, then use small hip shifts or gentle pressure if the moment builds.',

  ip141:
    'One partner lies back or sits comfortably while the other uses touch as a guided challenge. Choose a simple rule, like “tell me warmer or softer,” “guide my hand,” or “show me where to stay.” The receiving partner gives feedback through words, hand-over-hand guidance, or body cues. The giving partner moves slowly and follows the feedback without guessing. Keep the position easy so both partners can focus on communication and responsiveness.',

  ip142:
    'Choose a comfortable position, then decide that one partner will lead for a short time before switching. The leading partner can guide pace, touch, closeness, or angle with words or hands. After a few minutes, pause and let the other partner take over. Keep the switches clear and playful so nobody has to guess who is directing the moment. This works best in positions that are easy to hold while talking and adjusting.',

  ip143:
    'One partner wears a blindfold or closes their eyes while resting in a comfortable supported position. The other partner stays close and uses slow touch at non-rushed areas first, such as the hands, arms, face, shoulders, back, waist, or thighs. Check in clearly before and during the experience so the blindfolded partner feels safe and able to pause. Keep movement simple and grounded, letting anticipation and trust carry the moment.',

  ip144:
    'Both partners stand close together, ideally near a wall, bed, or sturdy surface. One partner can lean back slightly into the support while the other steps in close and holds at the waist, hips, or lower back. Keep the stance short and contained rather than trying to sustain it for a long time. Use kissing, slow pressure, or brief bursts of movement, then reset if balance or leg strength starts to fade.',

  ip145:
    'Both partners start on the bed in a playful tangle, rolling, laughing, or shifting close without needing a perfect position. One partner can pull the other into a cuddle, straddle, side hold, or face-to-face embrace. Keep pillows nearby so knees, elbows, or shoulders stay comfortable. Let the position evolve naturally from playful touch into closeness, pausing whenever the energy feels silly, sweet, or more intimate.',

  ip146:
    'Both partners lie side by side, either facing each other or angled shoulder-to-shoulder. Use slow teasing touch along the arms, waist, back, hips, thighs, or stomach while staying close enough to feel connected. One partner can guide the other’s hand or give simple feedback about what feels good. Keep the pace unhurried and let the side-by-side shape make the teasing feel relaxed instead of pressured.',

  ip147:
    'Begin in a comfortable position, then intentionally try small angle changes one at a time. Shift a knee wider, raise or lower the hips, rotate slightly to one side, or move closer to the bed edge. After each change, pause long enough to notice how it feels before changing again. One partner can guide with hands at the waist or thighs while the other gives feedback. The goal is slow exploration, not constant movement.',

  ip148:
    'Choose a position where one partner can clearly lead, such as a lap straddle, guided touch position, or face-to-face recline. The leading partner sets the pace, gives gentle direction, or chooses when to pause. The other partner focuses on receiving, responding, and giving feedback if anything needs to change. Keep the leadership warm and attentive, using hands, eye contact, and check-ins so the position feels confident but still mutual.',

  ip149:
    'Start in a relaxed cuddle, side-by-side hold, or face-to-face position on the bed or couch. One partner uses playful touch, light tickling, teasing kisses, or gentle nudges to bring laughter into the moment. When the energy softens, pull close for a kiss or still hold. Keep the touch light and easy to stop, especially if tickling is involved. This position works best when play turns naturally into closeness instead of being forced.',

  ip150:
    'Both partners settle into a cuddle position, such as spooning, side-by-side lying, or one partner resting against the other’s chest. One partner adds hidden or subtle touch under a blanket, along the waist, back, hip, thigh, or stomach while staying close. The receiving partner can guide the hand, press closer, or ask for a pause. Keep the energy flirty and private, using the cuddle shape to make touch feel secretive but safe.',

  ip151:
    'Both partners stand facing each other with enough space to sway comfortably. One partner places hands at the waist, hips, shoulders, or lower back while the other follows the movement. Start with a slow dance-like sway, letting the bodies find rhythm before moving closer. A wall, bed, or couch can be nearby for support if balance feels uncertain. Let the position stay romantic and playful, with kissing or gentle pressure added only if it feels natural.'
};

let updatedCount = 0;
const missing = [];

for (const [id, howTo] of Object.entries(howToUpdates)) {
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    missing.push(id);
    continue;
  }

  item.howTo = howTo;
  updatedCount += 1;
}

if (missing.length > 0) {
  console.error('Missing IDs. No file written:', missing.join(', '));
  process.exit(1);
}

fs.writeFileSync(targetPath, JSON.stringify(data, null, 2) + '\n');

console.log(`Updated howTo for ${updatedCount} positions.`);
console.log(`File: ${targetPath}`);
console.log(`Updated IDs: ${Object.keys(howToUpdates).join(', ')}`);

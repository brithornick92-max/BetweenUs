const fs = require('fs');

const targetPath = process.argv[2] || './content/intimacy-positions.json';

if (!fs.existsSync(targetPath)) {
  console.error(`Could not find file: ${targetPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const items = data.items || [];

const howToUpdates = {
  ip152:
    'One partner rests in a comfortable position while the other uses slow touch and frequent check-ins to learn what feels best. Start with simple prompts like “softer, firmer, slower, or stay there?” The receiving partner can answer with words, hand guidance, or small body shifts. Keep the position easy to hold so both partners can focus on feedback instead of performance. The goal is to turn touch into a conversation where both people feel listened to.',

  ip153:
    'One partner sits or reclines on the couch while the other straddles their lap or settles close across them. Use the couch back, cushions, or armrest for support so the position feels playful rather than unstable. The seated partner can hold the waist, thighs, or lower back while the straddling partner controls closeness and pace. Start with teasing stillness, kissing, or small shifts before adding stronger movement.',

  ip154:
    'One partner sits in a chair, on the couch, or at the edge of the bed and invites the other to come close. The second partner can sit in their lap, stand between their knees, or settle beside them with legs touching. Hands can rest at the waist, face, thighs, or back while the couple finds a comfortable distance. Let the first moments be slow and inviting, using eye contact, touch, or a gentle pull closer before building rhythm.',

  ip155:
    'Choose a comfortable position, then set a short playful rule for touch, such as thirty seconds of slow touch, one minute of only kissing, or taking turns choosing where hands go next. One partner starts while the other receives and gives feedback. When the timer or agreed cue ends, switch roles or change the focus. Keep the setup physically easy so the game feels fun, connected, and low pressure.',

  ip156:
    'One partner lies back, sits, or reclines while the other traces slow touch along the arms, chest, stomach, waist, hips, back, or thighs. The touch should move lightly at first, like drawing a path across the body, then pause wherever the receiving partner responds. The receiving partner can guide the hand, ask for more or less pressure, or pull the other closer. Keep the movement slow enough that anticipation becomes part of the position.',

  ip157:
    'One partner lies back while the other takes a confident top position, either facing them or slightly angled for comfort. The top partner uses hands on the bed, thighs, chest, or their own hips for balance and decides how open, close, or upright they want to be. The lower partner supports with hands at the waist, thighs, or lower back without taking over. Start with a slower pace so the top partner can find control and confidence before increasing intensity.',

  ip158:
    'Choose a position both partners already know they enjoy, then return to it with more attention and intention. Set up the familiar shape slowly instead of rushing into it. One partner can name what they liked last time, while the other adjusts angle, pace, or touch based on that memory. Keep the position simple and let the comfort of recognition do the work. The goal is to make a favorite feel chosen, not automatic.',

  ip159:
    'One partner reclines with pillows under the back, knees, hips, or shoulders so the body can fully relax. The other partner settles close beside, above, or between their legs, depending on the shape that feels safest and easiest. The supported partner can let their weight drop into the pillows while the other keeps touch slow and attentive. Before adding movement, check that the reclining partner feels open, comfortable, and able to pause at any time.',

  ip160:
    'One partner lies back while the other supports one of their legs at the thigh, calf, or ankle. The lifted leg can rest against the partner’s shoulder, hip, side, or arm depending on flexibility. The supporting partner should hold the leg gently and let it lower whenever needed. Start with the leg only slightly lifted, then adjust height and angle slowly. Keep the reclining partner’s hips and lower back supported so the stretch does not become strain.',

  ip161:
    'One partner leans back into the other’s chest, either sitting between their legs, lying against them, or resting back-to-chest on the couch. The partner behind wraps arms around the waist, stomach, chest, or shoulders and creates a steady hold. Let the front partner relax their weight backward while staying able to adjust or pause. Movement can stay minimal, with the focus on breathing together, feeling held, and letting the body settle into safety.',

  ip162:
    'One partner places their hands over the other partner’s hands and guides where touch should go. This can happen lying down, sitting together, or in a close lap position. The guiding partner can move the other’s hand to the waist, thigh, chest, back, face, or anywhere that feels welcome. The following partner lets the guidance lead instead of guessing. Keep the pace slow and use words or pressure to show when to stay, soften, or move on.',

  ip163:
    'One partner lies back or curls slightly inward while the other covers them with gentle body contact, either from above, beside, or behind. The covering partner should support enough weight through arms, knees, elbows, or the bed so the lower partner feels held, not trapped. Hands can wrap around the waist, shoulders, or back. Start with stillness and breathing, then add small movements only if the covered partner feels comfortable and grounded.',

  ip164:
    'Choose a close position and pause before going further. One partner asks or offers a clear check-in, such as “Do you want more?” “Is this still good?” or “Do you want slower?” Stay in the pause long enough for an honest answer. Hands can remain still at the waist, face, chest, or back while both partners reconnect. If the answer is yes, continue slowly. If anything feels uncertain, soften the position or shift into cuddling.',

  ip165:
    'One partner reclines on their back with pillows supporting the shoulders, hips, knees, or lower back. The other partner settles close in a position that allows the reclining partner to stay open without bracing. Hands can support the thighs, waist, stomach, or hips while the reclining partner lets the body release into the surface. Start with slow breathing and gentle touch, then add movement only after the supported partner feels relaxed and secure.',

  ip166:
    'Both partners stand near a wall. One partner leans their back, shoulder, or side against the wall while the other steps in close. Keep feet grounded and knees soft so neither person has to balance too hard. Hands can hold the waist, hips, lower back, or wall for stability. Begin with a close embrace or kissing, then add slow pressure or gentle movement while using the wall to reduce strain.',

  ip167:
    'Choose any comfortable position and build in a clear check-in before the intensity rises. Both partners agree on a word, phrase, or touch cue that means pause, slow down, or adjust. Stay close while talking, with hands grounded at the back, waist, hip, or thigh. The position itself can be simple; the point is making communication feel normal and protective. Continue only when both partners feel heard and comfortable.',

  ip168:
    'Settle face-to-face in a position that allows easy eye contact, such as side-lying, seated lap closeness, or a supported face-to-face recline. Once comfortable, pause movement and let one partner simply be seen by the other. Hands can rest at the face, heart, waist, or back. If the gaze feels intense, soften it with kissing, closing the eyes briefly, or resting foreheads together. Add movement only after the stillness feels safe.',

  ip169:
    'Choose a position where one partner can comfortably direct the pace, such as a lap straddle, guided touch hold, or supported recline. The directing partner uses words, hands, or body pressure to show what they want: closer, slower, softer, deeper, or pause. The other partner follows attentively and checks in if anything is unclear. Keep the guidance warm and collaborative so the position feels directed without feeling disconnected.',

  ip170:
    'Start in a close position where one partner can be gently held at the wrists, hands, waist, or hips without discomfort. Agree clearly that the hold is symbolic and easy to stop at any time. The holding partner uses light pressure, not force, while the held partner stays able to move, speak, or pause. Keep the pace slow and the contact reassuring. This position works best when the “edge” comes from trust and attention, not intensity.',

  ip171:
    'Both partners lie in a spooning position, with the partner behind wrapping around the front partner protectively. The front partner can hold the arm around them, bend the knees, or press back gently to feel more secure. The partner behind adjusts chest and hip closeness separately so the hold feels warm rather than restrictive. Use slow breathing, soft touch, and small movements while keeping the protective feeling at the center.',

  ip172:
    'One partner lies back while the other settles above them face-to-face. Once both bodies feel comfortable, interlace hands or hold palms together beside the head, against the bed, or between the bodies. The partner above supports enough weight through elbows, knees, or hands so the handhold feels intimate rather than limiting. Begin with slow movement and use the handhold to communicate pauses, closeness, or reassurance.',

  ip173:
    'One partner reclines into pillows with the body fully supported through the back, knees, hips, or neck. The other partner stays close and lets the supported partner set the pace. Hands can rest at the thighs, waist, stomach, face, or shoulders. Begin with stillness and a check-in, then add slow touch or gentle movement only when the reclining partner feels relaxed enough to let go. Keep the pillows in place rather than pushing through strain.',

  ip174:
    'One partner takes a comfortable position lying back, kneeling, or seated while the other holds their hips with both hands. The hip hold can guide pace, closeness, or angle, but it should stay responsive rather than controlling. The partner being held can shift, pause, or place hands over the other’s hands to redirect. Start with slow movement and let the hip hold become a way to communicate rhythm and security.',

  ip175:
    'One partner reclines with legs supported open by pillows, the other partner’s hands, or a comfortable surface. The legs should feel held, not forced wide. The other partner settles close and supports at the thighs, calves, waist, or hips while checking that the position feels safe and relaxed. Begin with stillness and slow touch, then build only if the supported partner remains comfortable in the open shape.',

  ip176:
    'Both partners settle face-to-face in a comfortable low-effort position, such as side-lying, seated lap closeness, or a supported recline. One partner names or shows what feels vulnerable — eye contact, being held, asking for touch, or staying still. The other partner responds slowly and reassuringly. Keep hands grounded at the back, waist, face, or hips. Let the position move at the pace of emotional safety rather than physical urgency.',

  ip177:
    'Begin with both partners close but not rushed, using a position that can pause easily, like cuddling, side-lying, or face-to-face recline. Move one step at a time: closer, touch, pause, check in, then continue only if both want to. The receiving partner can say yes, wait, slower, or not that, and the other partner follows immediately. This position is about gradual consent and building closeness without pressure.',

  ip178:
    'One partner lies back or curls into the bed while the other rests part of their body weight over them in a supported way. The partner above should use arms, knees, elbows, or pillows to control how much pressure is shared. The lower partner can ask for more weight, less weight, or a shift in placement. Keep breathing easy and check that the pressure feels grounding, not smothering. Small movements can be added once the weight feels comforting.',

  ip179:
    'Both partners use a wall, bed edge, couch, or sturdy surface as a guardrail for balance. One partner leans into the support while the other comes close and holds at the waist, hips, or back. Keep feet planted and knees soft. Start with a still embrace, then add slow movement only after the supported partner feels steady. The surface should make the position easier and safer, not more complicated.',

  ip180:
    'One partner sits with a stable base while the other settles into their lap facing them or slightly angled. The seated partner supports at the hips, lower back, or thighs while the lap partner wraps arms around the shoulders or rests hands at the chest. Use pillows under the knees or behind the seated partner’s back if needed. Begin with a held, cradled feeling, then let the rhythm stay small, close, and supported.',

  ip181:
    'Choose a soft supported position where one partner can fully yield into the surface or the other partner’s body. This might be lying back into pillows, curling into spooning, or resting chest-to-chest with supported weight. The supporting partner keeps contact steady at the back, hips, waist, or shoulders. Pause before adding movement and let the yielding partner settle first. Continue only with slow, gentle motion that keeps the body relaxed.',

  ip182:
    'One partner reclines near the edge of a bed or surface while the other approaches from a diagonal angle instead of straight on. The reclining partner can shift hips slightly, bend one knee outward, or rest one leg along the other partner’s side. The partner at the edge supports the thigh, hip, or waist while testing the angle slowly. Pause after each adjustment so both partners can feel whether the diagonal position works.',

  ip183:
    'One partner lies back with hips elevated on pillows, a wedge, folded blankets, or the edge of a cushion. The other partner settles close, supporting the thighs, hips, or waist as needed. Keep the elevation moderate at first so the lower back does not feel strained. The reclining partner can bend knees or keep feet planted for grounding. Begin slowly and adjust the height before increasing pace.',

  ip184:
    'Both partners stand near a step, low platform, sturdy chair base, or bed edge. One partner places one foot slightly higher on the step or surface while keeping the other foot grounded. The other partner stands close and supports at the waist, hips, or lifted thigh. Keep a wall or surface nearby for balance. Start with a lower step than expected and move slowly until both partners feel stable.',

  ip185:
    'One partner reclines on a sturdy counter-height surface or firm bed edge with hips close enough to the edge for the other partner to stand comfortably. The reclining partner can bend knees, rest feet on the surface, or let legs hang with support. The standing partner keeps hands at the thighs, hips, or waist to stabilize the setup. Check that the surface is safe and the height works before adding movement.',

  ip186:
    'Both partners stand with one partner in front and one behind, using a wall, counter, or bed edge for support. The front partner can lean slightly forward or place hands on the surface while the partner behind stays close at the hips. Keep knees soft and feet grounded. Begin with small movements and steady hand support at the waist, hips, or lower back. Reset if either partner feels off balance.',

  ip187:
    'One partner sits or lies back while the other straddles from a slight sideways angle rather than directly face-to-face. The straddling partner can use hands on the bed, thighs, or partner’s body for balance while adjusting how much they rotate. The lower partner supports at the waist, hips, or thighs. Start with a partial sideways angle and pause to check comfort before turning farther or building rhythm.',

  ip188:
    'Both partners start in a close seated or lying position, then adjust one or both legs into a crossed or angled shape. One partner may cross a leg over the other’s hip, tuck a knee inward, or angle the thighs to create a new path of contact. Keep the leg placement loose and easy to undo. Begin with slow pressure and small movements, adjusting immediately if the knees or hips feel strained.',

  ip189:
    'One partner lies back in a classic face-to-face position while the other settles above them, then both partners rotate slightly to one side. The reclining partner can shift hips or knees while the partner above changes hand placement for support. Keep the rotation small at first; even a slight pivot can change the sensation. Once the angle feels comfortable, build a slow rhythm without losing the face-to-face connection.',

  ip190:
    'One partner lies near the edge of the bed with hips close enough for the other partner to stand or kneel comfortably. The reclining partner can keep feet planted, legs bent, or calves resting around the standing partner. The standing partner supports at the thighs, hips, or waist and checks that the bed height works. Begin slowly, using the edge to create support and angle rather than pulling the body off balance.',

  ip191:
    'Both partners stand close with a wall, bed, or sturdy surface nearby. One partner partially lifts or supports the other at the hips, thighs, or seat, but keeps the lifted partner close to their body to reduce strain. The lifted partner can wrap arms around the shoulders and keep one or both feet touching a surface if needed. Use short, supported moments rather than trying to hold the lift for a long time.',

  ip192:
    'One partner lies back or stands supported while lifting one leg to hook around the other partner’s hip, waist, or thigh. The other partner supports the hooked leg gently and stays close enough that the raised leg does not have to hold tension. Keep the second leg grounded or comfortably bent. Start with the hook low and relaxed, then adjust height only if the hips, knees, and balance feel comfortable.',

  ip193:
    'Begin in a comfortable front-facing position, then slowly shift toward a side angle without fully separating. One partner can rotate the hips, move one knee outward, or guide the other partner’s body slightly to the side. Pause in the new angle and decide whether to stay, return to the front, or shift again. Keep the changes slow and collaborative so the position feels exploratory rather than awkward.',

  ip194:
    'One partner bends forward over a bed, couch, counter, or sturdy surface with hands, forearms, or chest supported. The other partner stands or kneels behind, staying close and using hands at the waist, hips, or lower back for stability. The front partner can widen their stance or bend knees slightly to make the height work. Start slowly and adjust the surface height or distance before building rhythm.',

  ip195:
    'Both partners kneel close together on a cushioned surface. One partner stays more upright while the other moves in close, using arms around the shoulders, waist, or back for balance. Pillows under the knees can reduce pressure. Keep the hips close and adjust torso height before adding movement. This position works best with a steady embrace, slow pressure, and frequent comfort checks for knees and lower back.',

  ip196:
    'One partner reclines with legs wide but supported by pillows, the bed, or the other partner’s hands. The other partner settles close between the legs, supporting at the thighs, calves, hips, or waist as needed. The open shape should feel stable, not forced. Begin with the legs lower and more relaxed, then adjust outward only if comfortable. Use slow movement and keep checking for hip or lower-back strain.',

  ip197:
    'One partner sits with legs angled to the side while the other settles into a seated straddle from the side rather than directly front-facing. The straddling partner can brace with hands on the bed, couch, or partner’s shoulders. The seated partner supports at the waist, hips, or lower back. Start with a small sideways angle, then adjust leg placement and distance until both partners feel balanced and close.',

  ip198:
    'Both partners lie or sit close while one partner approaches from the side rather than straight on. The receiving partner can bend one knee, open one hip, or angle their body slightly to create space. The other partner supports with hands at the waist, thigh, hip, or surface underneath. Move slowly while finding the side-entry angle, because small shifts in leg placement can make the position much easier or harder.',

  ip199:
    'Start with a comfortable base position, then let the couple choose the angle together. Try one adjustment at a time: lift the hips, rotate slightly, change knee width, move closer to the edge, or switch who is leading. After each change, pause and ask whether it feels better, worse, or just different. Keep the mood playful and exploratory, with permission to return to the easiest version at any time.',

  ip200:
    'One partner reclines on a higher sturdy surface, such as a firm bed, couch back edge, or counter-height surface, while the other stands or kneels close. The reclining partner keeps hips close enough to the edge that the standing partner does not have to overreach. Use hands at the thighs, hips, waist, or surface for stability. Begin with a slow check of height, balance, and comfort before adding rhythm.',

  ip201:
    'After intimacy, return to a favorite hold that helps both partners feel close and settled. This might be spooning, face-to-face cuddling, one partner resting on the other’s chest, or holding hands side by side. Let breathing slow and use gentle touch at the back, hair, arm, waist, or thigh. The goal is to end with warmth and reassurance, giving the body and relationship a soft place to land.'
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

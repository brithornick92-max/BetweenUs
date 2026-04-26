const fs = require('fs');

const targetPath = process.argv[2] || './content/intimacy-positions.json';

if (!fs.existsSync(targetPath)) {
  console.error(`Could not find file: ${targetPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const items = data.items || [];

const howToUpdates = {
  ip101:
    'One partner lies back with a pillow or folded blanket under their hips while the other settles close between their legs. The lifted hips create a softer, more supported angle without requiring much effort from either person. Start with the reclining partner adjusting the pillow height until their lower back feels comfortable, then let the partner above come in close with hands planted beside the body or resting at the hips for support. Keep the first movements slow and small while both partners check the angle, pressure, and comfort.',

  ip052:
    'One partner lies back while the other comes in close on top, keeping the bodies aligned chest-to-chest rather than creating a lot of space. The partner above stays low enough that the pelvises remain connected, then uses a slow rocking or gliding motion instead of thrusting away from the body. The receiving partner can wrap their legs loosely, keep feet planted, or use a pillow under the hips to find a better angle. This position works best when both partners stay close and let rhythm come from pressure, breath, and small body shifts.',

  ip053:
    'One partner lies back near the edge of the bed or another sturdy surface with their hips close to the edge. The other partner kneels or stands between their legs, depending on the height of the surface. The reclining partner can rest their legs around the standing partner, bend the knees, or let the legs open comfortably while the partner in front supports at the thighs, hips, or waist. Start by adjusting distance from the edge before adding movement, because a few inches closer or farther away can completely change the angle.',

  ip054:
    'One partner sits upright in a sturdy chair with both feet grounded while the other settles into their lap facing them. The top partner can wrap their arms around the seated partner’s shoulders and keep their knees or feet supported by the chair, floor, or nearby surface. The seated partner supports at the waist, hips, or lower back so the top partner does not have to hold all the balance alone. Begin with stillness, eye contact, and small rocking motions before building any stronger rhythm.',

  ip055:
    'Both partners lie on their sides facing the same direction, with one partner curled close behind the other. The front partner keeps their knees slightly bent and relaxed, while the partner behind adjusts their hips close enough to create comfortable contact without crowding the upper body. A pillow between the knees can reduce hip strain. Let the movement stay small and lazy, using slow pressure, breathing, and gentle hip shifts rather than a large range of motion.',

  ip056:
    'Both partners lie on their sides facing each other. One partner lifts their top leg and drapes it over the other partner’s hip or thigh, creating a gentle opening through the pelvis while keeping the upper bodies close. The lower legs can stay relaxed, bent, or loosely tangled depending on comfort. Start by adjusting the top leg higher or lower until the angle feels natural, then use small rocking motions while staying close enough for kissing, touch, or eye contact.',

  ip057:
    'One partner lies back while the other comes in close above them in a classic face-to-face position. The reclining partner wraps their legs loosely around the other partner’s waist, hips, or lower back, using the wrap to invite closeness rather than to pull hard. The partner above supports their weight with forearms, hands, or elbows so the pressure feels comfortable. Begin slowly, letting the leg wrap guide how close the bodies stay, then adjust the tightness of the wrap if either person needs more space.',

  ip058:
    'Both partners stand close to a wall, with one partner’s back or shoulders supported by the wall for stability. The other partner stands in front, close enough that the bodies can stay connected without either person leaning or reaching too far. The wall-supported partner can keep both feet grounded, lift one leg slightly, or wrap a leg around the other partner if balance feels secure. Keep hands at the waist, hips, wall, or shoulders for support, and start with slow movement until the stance feels steady.',

  ip059:
    'One partner stands, kneels, or leans forward over the edge of a bed with their chest, forearms, or hands supported by the mattress. The other partner positions behind them, staying close at the hips and using the bed height to reduce strain. The front partner can bend the knees slightly, widen their stance, or place a pillow under the torso if the surface feels too low. Before building rhythm, both partners should adjust hip height, foot placement, and distance from the bed so the position feels grounded instead of forced.',

  ip060:
    'One partner lies on their stomach with a pillow under the hips, lower belly, or chest to create a comfortable lift. The other partner settles close from behind, keeping their body low enough that the position feels warm and grounded rather than overly arched. The partner lying down can bend one knee outward slightly to open the angle or keep both legs long for a softer version. Use slow, close movement and adjust the pillow height if the lower back or hips feel compressed.',

  ip061:
    'One partner sits comfortably on a chair, couch, or edge of the bed with their legs open enough to feel relaxed and supported. The other partner kneels, sits low, or settles between their legs in a position that keeps the neck and shoulders comfortable. Use pillows under the kneeling partner’s knees or under the seated partner’s hips if needed. Start by finding a height where the giving partner does not have to strain upward, then let the seated partner guide closeness, pace, and pressure through words or touch.',

  ip062:
    'One partner reclines on the bed, couch, or floor with pillows supporting their head, back, or hips. Their legs can stay bent, open, or resting over the other partner’s thighs depending on comfort. The giving partner kneels or lies low between them, using hands at the thighs, hips, stomach, or waist to keep the receiving partner grounded and attended to. This position works best when the receiving partner is fully supported and the giving partner takes time to notice small cues rather than rushing.',

  ip063:
    'Both partners stand close together with a wall, bed, counter, or sturdy surface nearby for balance. One partner keeps one foot grounded and raises the other leg slightly, resting it around the other partner’s hip, thigh, or waist if that feels stable. The standing partner in front supports at the lifted thigh, waist, or lower back while keeping their own stance grounded. Start with the lifted leg lower than expected, then raise or adjust it only if both partners feel balanced and comfortable.',

  ip064:
    'One partner lies back while the other settles above them face-to-face. The reclining partner wraps both legs around the other partner’s waist or hips, keeping the wrap soft enough that both bodies can still adjust. The partner above supports their weight through hands, elbows, or forearms and stays close through the chest and stomach. Begin by finding the right amount of leg pressure, then use slow rocking or short, controlled movement so the closeness feels secure rather than tense.',

  ip065:
    'One partner lies or reclines diagonally near the edge of the bed while the other stands or kneels at the side instead of directly between the legs. The reclining partner can bend one or both knees, rest a leg along the partner’s side, or use a pillow under the hips for lift. The partner at the edge supports the thigh, hip, or bed surface while both partners adjust the sideways angle. Move slowly at first, because this position depends more on alignment than speed.',

  ip066:
    'Choose any comfortable close position, such as face-to-face lying, spooning, or one partner resting over the other with supported weight. Once both partners are settled, pause movement completely for a short moment. Keep hands somewhere grounding — on the back, hip, chest, waist, or face — and let the focus be breathing, closeness, and noticing each other. If movement returns, keep it very slow and intentional so the stillness remains part of the experience.',

  ip067:
    'Both partners kneel facing each other on a soft surface, with knees cushioned by the bed, pillows, or a folded blanket. One partner can sit back slightly on their heels while the other moves closer, or both can stay upright with arms wrapped around shoulders and backs for balance. Keep the hips close and use hands at the waist, lower back, or thighs for support. Begin with a steady embrace first, then adjust how upright or relaxed the bodies are before building rhythm.',

  ip068:
    'One partner lies back while the other comes in close above them. The reclining partner lifts one leg and rests it over the other partner’s shoulder or upper arm, while the other leg stays bent, open, or grounded for comfort. The partner above supports the lifted leg gently without forcing the stretch, keeping one or both hands available for balance. Start slowly and adjust the height of the lifted leg often, because lowering it even slightly can make the position much more comfortable.',

  ip069:
    'One partner lies back while the other straddles them from above in a comfortable riding position. Instead of moving only up and down, the top partner experiments with small circles, figure-eights, or slow forward-and-back motions through the hips. Hands can rest on the lower partner’s chest, thighs, the bed, or their own thighs for support. Keep the circles small at first so the top partner can control pressure, angle, and balance without tiring too quickly.',

  ip070:
    'After intimacy, both partners choose a comfortable holding position rather than separating right away. This can be spooning, one partner resting on the other’s chest, face-to-face cuddling, or lying side by side with hands connected. Let the bodies settle, keep breathing slow, and use gentle touch at the back, hair, arm, or waist. The goal is not movement, but helping both partners feel emotionally gathered, appreciated, and close after the intensity has passed.',

  ip071:
    'Both partners come into a close chest-to-chest position, either lying down, seated, or wrapped in a soft embrace. Once comfortable, pause and let the bodies stay still for a few breaths. Hands can rest over the heart, along the back, at the waist, or around the shoulders. If movement begins, keep it subtle and synchronized, using breath and pressure as the guide instead of trying to create a strong pace.',

  ip072:
    'Partners settle face-to-face in any comfortable position, such as lying on their sides, sitting together, or one partner resting above the other with supported weight. Bring foreheads close enough to touch or nearly touch, then pause there. Keep hands somewhere steady, such as the face, neck, waist, or back. Let the position begin with eye contact, breathing, or a quiet check-in before adding any movement, so the closeness feels emotionally safe and deliberate.',

  ip073:
    'One partner reclines slightly against pillows, a headboard, or the back of a couch while the other sits or settles into their lap facing them. The reclining partner keeps their back supported so they can hold the other partner without strain. The partner in the lap can wrap arms around the shoulders, keep knees supported by the surface, or shift weight through the hips to find comfort. Start with a relaxed embrace, then add slow rocking only after both partners feel settled.',

  ip074:
    'One partner lies back in a classic face-to-face position while the other settles above them with their weight supported through hands, elbows, or forearms. Keep the bodies close, but not so pressed together that breathing or movement feels restricted. The reclining partner can keep legs bent, loosely wrapped, or resting open with pillows under the knees if needed. Use slow movement, gentle kissing, and small angle changes to keep the position soft rather than intense.',

  ip075:
    'Both partners choose a position where as much of the body as possible can be held comfortably, such as spooning, face-to-face lying, or one partner resting partially over the other with supported weight. The holding partner wraps arms around the back, waist, or shoulders while the receiving partner relaxes into the contact. Use pillows to support knees, hips, or shoulders so nobody has to tense to stay close. Keep the focus on warmth, pressure, and feeling safely gathered in.'
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

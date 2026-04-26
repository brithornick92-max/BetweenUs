const fs = require('fs');

const targetPath = process.argv[2] || './content/intimacy-positions.json';

if (!fs.existsSync(targetPath)) {
  console.error(`Could not find file: ${targetPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const items = data.items || [];

const howToUpdates = {
  ip076:
    'Start in a comfortable face-to-face position, either lying down or with one partner slightly above the other. Bring the bodies close enough that the rhythm can come from the hips rocking together rather than from pulling apart. The partner above can support their weight on forearms, hands, or elbows, while the reclining partner uses hands at the back, waist, or hips to guide closeness. Begin with slow, shallow rocking and let both partners adjust pressure before increasing intensity.',

  ip077:
    'One partner sits upright with their back supported by a wall, headboard, couch, or pillows. The other partner settles into their lap facing them, wrapping arms around the shoulders or resting hands at the chest, neck, or upper back. The seated partner holds at the waist, hips, or lower back to help keep balance steady. Let the position begin as a hug first, then add gentle rocking, circling, or small hip shifts only once both partners feel settled and supported.',

  ip078:
    'Both partners lie on their sides facing each other with pillows under the head or between the knees if needed. One partner wraps a top leg loosely around the other partner’s hip or thigh, creating a soft opening while keeping the upper bodies close. The other partner can hold the lifted leg, waist, or lower back to keep the shape comfortable. Start with small adjustments through the hips and let the rhythm stay slow enough that kissing, eye contact, or touch still feels easy.',

  ip079:
    'One partner lies back while the other settles above them in a classic face-to-face position. Once comfortable, both partners bring their hands together and interlace fingers, either beside the head, against the bed, or resting between their bodies. The partner above supports enough weight through arms or elbows so the handhold feels connecting rather than restrictive. Keep the rhythm slow at first, using the handhold as a way to stay present and communicate pressure, closeness, or pauses.',

  ip080:
    'One partner lies back and wraps their legs around the other partner’s waist, hips, or lower back in a way that feels close but not tight. The partner above stays low and connected, supporting their weight with hands, elbows, or forearms. The leg wrap can guide the rhythm by inviting the bodies closer during movement and softening when more space is needed. Begin with gentle pressure and small movements, then adjust the height of the wrapped legs until the angle feels comfortable.',

  ip081:
    'Choose a comfortable position for kissing and holding, such as lying side by side, sitting close together, or one partner resting partially above the other. Let the first focus be the kiss itself rather than trying to move quickly into anything else. Hands can rest at the face, neck, waist, chest, or back while both partners stay close and relaxed. If the moment becomes more physical, keep the movement slow and let the kiss guide the pace instead of rushing the body position.',

  ip082:
    'One partner reclines slightly against pillows, a headboard, or the arm of a couch while the other settles close against them chest-to-chest. The reclining partner should feel supported through the back and shoulders so they can relax into the contact. The partner above or beside them can wrap arms around the torso, rest a hand at the waist, or shift hips slowly to find a comfortable rhythm. Keep the bodies close and use small movements so the position feels warm rather than demanding.',

  ip083:
    'Both partners kneel facing each other on a soft surface, with pillows or a folded blanket under the knees if needed. One partner may stay upright while the other moves closer, or both can wrap arms around each other for balance. Hands can support the waist, lower back, shoulders, or hips while the bodies find a comfortable height. Start with a close embrace and slow breathing, then explore small hip movements or gentle pressure while keeping the knees and lower back supported.',

  ip084:
    'Settle into any position where both partners can see each other comfortably, such as side-lying face-to-face, seated lap closeness, or a supported face-to-face recline. Once the bodies feel stable, pause and hold eye contact for a few breaths. Hands can rest at the face, heart, waist, or back to keep the moment grounded. If movement begins, keep it subtle and slow so the eye contact remains possible instead of becoming something to avoid or rush through.',

  ip085:
    'Choose a close, comfortable position where both partners can pause without strain, such as spooning, face-to-face lying, or one partner resting above the other with supported weight. Once the position feels steady, stop moving for a short stretch and notice breathing, warmth, and contact. Hands can stay still at the back, hips, stomach, chest, or thighs. If either partner wants to continue, begin again with tiny movements so the pause remains part of the intimacy rather than an interruption.',

  ip086:
    'Begin with a full-body hug in a position that feels natural: standing, sitting, lying face-to-face, or with one partner in the other’s lap. Let the bodies settle before trying to create rhythm. The partner being held can relax weight into the embrace, while the holding partner supports at the back, waist, hips, or shoulders. When movement begins, keep it slow and close, using the embrace to create a sense of reunion, repair, or coming back together.',

  ip087:
    'Both partners lie close in a relaxed morning-style cuddle, either spooning or facing each other. Keep pillows under the head and knees so no one has to tense to stay in place. One partner can slide closer from behind or draw the other into a soft face-to-face hold, depending on what feels easiest. Use slow touch, small hip shifts, and quiet check-ins rather than strong movement. This one works best when the body still feels sleepy and unhurried.',

  ip088:
    'Both partners lie or sit facing each other and let the legs loosely weave together. One partner can slide a leg between the other’s legs, hook a calf gently, or rest a thigh over the other partner’s hip. The goal is not a tight knot, but enough contact that the bodies feel linked. Once the legs are comfortable, adjust the upper bodies closer and use slow rocking or stillness. If the hips feel crowded, loosen the leg tangle before changing anything else.',

  ip089:
    'One partner lies back with pillows supporting the head, shoulders, hips, or knees while the other settles close face-to-face. The pillows should help the reclining partner feel open and relaxed without arching or holding tension. The partner above can support their weight through forearms or hands, keeping the chest close enough for touch and kissing. Begin by adjusting pillow height and hip angle, then use slow movement so the supported shape feels intentional and comfortable.',

  ip090:
    'One partner reclines against pillows or lies back with the body fully supported, while the other settles close beside, above, or partly across them. The receiving partner should not have to hold a position with effort; pillows can support the neck, knees, lower back, or shoulders. The other partner wraps arms around the waist, chest, or back and keeps movement minimal at first. Let the position feel like landing together — soft, supported, and easy to pause in.',

  ip091:
    'One partner lies back while the other comes on top in a close, hugging position. The top partner lowers their chest enough to create warmth and contact, while supporting weight through knees, forearms, or hands so the lower partner does not feel crushed. The lower partner can wrap arms around the back or rest hands at the hips to guide pressure. Start with stillness, then add slow rocking or gentle shifting while keeping the hug at the center of the position.',

  ip092:
    'Both partners lie on their sides in a cuddle position, either facing the same direction or angled slightly toward each other. One partner uses slow touch along the arm, waist, stomach, back, hip, or thigh while staying close. The other partner can guide the touch with their hand, words, or small body shifts. Keep the position relaxed and low-effort, using pillows between the knees or under the head if needed so the touch feels soothing instead of distracting.',

  ip093:
    'Both partners lie in a close spooning position with the partner behind wrapping around the front partner as fully as feels comfortable. The front partner can bend their knees, hold the arm around them, or press back slightly to find secure contact. The partner behind adjusts chest, stomach, and hip closeness separately so the hold does not feel too tight. Use a pillow between the knees if hips need support, and let the rhythm stay slow, wrapped, and protective.',

  ip094:
    'Both partners lie on their sides, either facing each other or spooning, in a position that could be held comfortably for a long time. Keep the hips close enough for gentle rocking, but let the upper bodies stay soft and supported. One partner can place a hand at the waist, lower back, or thigh to guide the rhythm. Use small sleepy movements, long pauses, and relaxed breathing. If either person starts to tense, reset the pillows or loosen the leg position.',

  ip095:
    'One partner reclines on the bed, couch, or floor with pillows supporting the back and neck, while the other settles close into their side, lap, or chest. Let the position begin as a warm cuddle before adding any movement. Hands can rest along the back, hair, waist, stomach, or thigh. If the bodies shift into more intimacy, keep the support in place and move slowly so the reclined partner can stay relaxed instead of bracing.',

  ip096:
    'Start in a lazy morning position, such as spooning under a blanket, face-to-face side-lying, or one partner resting against the other’s chest. Keep the lighting, pace, and touch soft. One partner can draw the other closer through the waist or hips while the other adjusts knees, pillows, or leg placement for comfort. Let the position stay unpolished and easy, with slow touch and small movements that match a sleepy, affectionate mood.',

  ip097:
    'Both partners lie side by side, either facing each other or angled in the same direction, with the bodies close enough for gentle contact. Instead of a strong thrusting motion, use slow rocking through the hips, thighs, or pelvis. Hands can rest at the waist, back, hip, or shoulder to help guide the movement. This works best when both partners keep the motion small and steady, letting the rhythm feel like a tide moving in and out.',

  ip098:
    'Create a comfortable nest with pillows behind the back, under the knees, beneath the hips, or along the sides of the body. One partner reclines into the support while the other settles close in whatever position feels most natural: beside them, over them, or curled into them. Adjust the pillows before adding movement so the body can relax. Let the position focus on softness, warmth, and supported closeness rather than a perfect shape.',

  ip099:
    'One partner reclines with pillows under the hips, knees, or back while the other settles low between their legs in a supported giving position. The giving partner should use pillows under the chest, elbows, or knees if their neck or shoulders start to strain. The receiving partner can keep legs bent, open, or resting lightly around the giver’s shoulders depending on comfort. Start slowly and use verbal check-ins or gentle touch to guide pressure and angle.',

  ip100:
    'One partner lies on their stomach or slightly angled to one side with a pillow under the chest, hips, or lower belly. The other partner lies partly over or behind them, wrapping an arm around the waist, shoulder, or chest to create a held feeling. Keep the top partner’s weight supported through elbows, knees, or the bed so the lower partner can breathe and relax. Use small, slow movements and adjust the pillow height if the lower back feels compressed.'
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

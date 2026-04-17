/**
 * Transforms intimacy-positions.json:
 * - Renames setup → howTo, whyItWorks → benefits
 * - Adds makeItHotter field
 * - Removes variants object
 * - Rewrites content in editorial style
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const rewritten = {
  ip001: {
    howTo: "The giving partner sits on the floor with one leg bent and one extended. The receiving partner climbs into their lap facing away, then arches their entire upper body backward — spine curving open, arms spreading wide, face tilting toward the ceiling. The giving partner wraps both arms around from behind, supporting them through the arch.",
    benefits: "The full backward arch opens the receiving partner's chest and throat completely, creating a feeling of total surrender. As they arch back, their chest comes within reach of their partner's mouth — kisses, breath, and light attention to the nipples are easy and intensely felt from this angle. The asymmetric seated base keeps the giving partner grounded while everything above is wide open.",
    makeItHotter: "As the receiving partner arches back, they're completely exposed — the giving partner can run both hands slowly up their torso, trace their throat, or explore freely while their partner opens wider into the arch.",
  },
  ip002: {
    howTo: "The giving partner sits with legs extended. The receiving partner sits between their legs facing away, then arches their upper body all the way backward — spine opening, face pointing toward the ceiling, arms surrendering to the sides. The giving partner wraps their arms around the front of the arching body and holds them secure.",
    benefits: "The dramatic arch opens the front partner's chest and throat completely — a position of total openness and trust. The giving partner feels the full weight and surrender of being leaned into. The angle creates intense sensation that builds steadily the longer you stay.",
    makeItHotter: "While the front partner arches back, the back partner's mouth is right at their neck and shoulders. Slow kisses, light biting along the side of the neck, or whispering directly into their ear while they arch turns this into full sensory overload.",
  },
  ip003: {
    howTo: "The giving partner lies back comfortably. The receiving partner straddles them facing their feet, sitting fully upright. Hands can rest on their partner's shins or the bed for balance — whatever feels steady works.",
    benefits: "Flipping around changes everything — the angle, the sensation, and the dynamic. The receiving partner is fully in control of pace and depth, and both partners get a completely different view of each other. It's the same connection with an entirely new feeling.",
    makeItHotter: "Try a mirror in front of the top partner — both partners can see each other's expressions in real time. The receiving partner can also reach back to grip their partner's thighs, pulling them in for more depth.",
  },
  ip004: {
    howTo: "The receiving partner positions on their hands and knees. The giving partner kneels behind them, hands resting on their hips or lower back. Both settle into a rhythm together — deep and close, at whatever pace feels right.",
    benefits: "The from-behind angle allows deep physical connection while building a particular kind of trust — you feel your partner completely without seeing their face, which has its own intensity. The giving partner can lean forward for full-body closeness or stay upright for more control.",
    makeItHotter: "The front partner reaches back and takes the giving partner's hand, guiding it wherever they want it — or the giving partner wraps an arm around to the front, adding touch while keeping the rhythm going.",
  },
  ip005: {
    howTo: "The giving partner sits and leans back onto both hands, lifting their hips off the ground in a reverse tabletop. The receiving partner straddles them facing forward. The receiving partner can sit upright or arch their own body back dramatically — both settle into balance together.",
    benefits: "The reverse tabletop lifts the hips into a unique angle that changes the feel of everything. The receiving partner's freedom to arch back adds a sense of abandon that's hard to find in more grounded positions. It takes a moment to find your footing — then it's completely worth it.",
    makeItHotter: "The giving partner has nothing to do but hold on and enjoy the view — use that stillness to really look at each other. The receiving partner can slow way down and hold at the deepest point before deciding when to move again.",
  },
  ip006: {
    howTo: "The giving partner lies back. The receiving partner straddles them facing away, then slowly leans all the way back until their back rests flat against their partner's chest. The giving partner wraps both arms around from behind. Both bodies settle into a full-length embrace.",
    benefits: "The lean-back flip transforms a familiar angle into something unexpectedly intimate. Chest to back, arms completely wrapped around — the top partner is held from every side. The angle creates deep pressure while the full-body contact makes it equal parts sensation and closeness.",
    makeItHotter: "Once fully leaned back, both sets of hands are free. Run them down each other's bodies, add a toy, or have the leaned-back partner reach back and grip their partner's thighs behind them.",
  },
  ip007: {
    howTo: "The receiving partner gets on their knees and lowers down to their forearms, head resting on their folded arms. The giving partner kneels over them from behind, chest pressing toward their partner's back, hands on either side. Both bodies stack and align from knees to shoulders.",
    benefits: "The receiving partner's low forearm position deepens the angle and creates an almost gravitational pull toward closeness. The giving partner draped completely over creates a full-body overlay — maximum contact, a primal sense of being entirely covered, and almost nowhere left to go.",
    makeItHotter: "The giving partner is right at their partner's ear — whisper exactly what you're feeling. The closeness means even the smallest movements are felt everywhere; try barely moving at all and just breathing together.",
  },
  ip008: {
    howTo: "The giving partner lies on their back. The receiving partner straddles them, sitting fully upright. The receiving partner controls all the movement — speed, depth, angle. The giving partner's hands are free to move wherever they want.",
    benefits: "This position is about transfer of power — the receiving partner is completely in charge, which is equal parts empowering and electric to watch. The giving partner practices the rarer skill of surrender: letting someone else set every detail of the pace and trusting them completely.",
    makeItHotter: "Try locking eyes and not breaking contact, no matter what. The receiving partner can slow to an almost-stop and hold there — using the pause as its own kind of touch — then decide when to move again.",
  },
  ip009: {
    howTo: "The receiving partner lies flat on their stomach. The giving partner kneels over them from behind, leaning forward with arms wrapped around, body curled close. Movement stays slow and minimal — this one is about warmth and weight, not pace.",
    benefits: "The kneeling-over position keeps the giving partner enveloping and close without putting their full weight on their partner. It has the feeling of being completely held from behind — a cocoon. Perfect for slow mornings or late nights when you want closeness without any effort.",
    makeItHotter: "The giving partner can reach around to the front with one hand, making the position feel like being completely surrounded. Keep everything slow and barely moving — focused on warmth rather than rhythm.",
  },
  ip010: {
    howTo: "The receiving partner lies on their back. The giving partner positions on top, chest to chest, weight resting on their forearms. Faces are close enough to kiss, whisper, and hold eye contact the entire time.",
    benefits: "There's a reason this is the most intimate position — full frontal contact, easy eye contact, natural kissing distance at all times. Slowing it all the way down and focusing on the chest-to-chest contact rather than movement turns the familiar into something that can feel completely new.",
    makeItHotter: "Put your foreheads together and match each other's breathing, breath for breath. Try going so slow you're barely moving — just feeling the pressure and warmth — and see how long you can hold it.",
  },
  ip011: {
    howTo: "The giving partner stands firmly and lifts their partner completely off the ground. The lifted partner wraps their legs around their partner's waist and arms around their shoulders. Stepping back against a wall behind the giving partner takes most of the effort out of holding the position.",
    benefits: "Being lifted completely off the ground is its own kind of vulnerability — there's nowhere to go, no way to brace, just complete trust. The face-to-face height puts both partners eye to eye in a way that only happens here. Everything is amplified because nothing about this position lets you be distracted.",
    makeItHotter: "With the wall taking the weight, both the giving partner's hands are free. Use them — the lifted partner is right there at chest height, completely accessible from every angle.",
  },
  ip012: {
    howTo: "The receiving partner positions on all fours at the edge of a bed or surface, then raises one leg upward — nearly vertical. The giving partner kneels behind them, holding the raised leg with both hands. The height of the hold directly changes the depth and angle.",
    benefits: "Raising one leg straight up dramatically opens the hip and creates one of the deepest angles available in a rear-entry position. The giving partner has direct, immediate control over sensation just by adjusting how high they hold — a small change makes a significant difference.",
    makeItHotter: "Ask your partner to tell you when you hit the right angle, then stay exactly there. Try lowering the leg slightly mid-way through to feel the shift — then bring it back up.",
  },
  ip013: {
    howTo: "The receiving partner lies on their back with hips right at the edge of the bed, then lets their upper body hang off the edge — arms reaching toward the floor for support. The giving partner stands between their legs, holding their hips or thighs to keep them steady.",
    benefits: "The inverted upper body sends blood rushing to the head, which heightens sensitivity across the whole body. The giving partner has full control while the receiving partner is in a completely open, head-down, surrendered position — the combination is intense in a way that's hard to find anywhere else.",
    makeItHotter: "The receiving partner will feel a head-rush from being inverted — take slow breaths and let the feeling build rather than rushing through it. That heightened state makes every sensation hit harder.",
  },
  ip014: {
    howTo: "The giving partner stands with arms ready to hold. The receiving partner steps in close, wraps their legs around their partner's hips, and holds on around their neck or shoulders. Both faces end up level — close enough to kiss with every movement.",
    benefits: "Everything comes into contact at once: full body, upright, face to face, nowhere left to go but closer. The wrap creates a sense of being completely held while staying deeply connected. There's no separation here — just pressure and presence from every direction.",
    makeItHotter: "Back the giving partner against a wall — it gives them something to brace against and frees their hands completely. From there, the lifted partner is surrounded with nothing to hold onto but each other.",
  },
  ip015: {
    howTo: "The receiving partner starts on all fours, then lowers to their forearms, forehead resting on their folded arms. The giving partner kneels behind them. The drop to forearms changes the geometry entirely — deeper, more open, more surrendered.",
    benefits: "Dropping to the forearms shifts the angle to one of the deepest available in any rear-entry position, and it requires no extra flexibility — just a willingness to let go. The position has a naturally surrendered quality that the giving partner tends to feel just as much as the receiving partner.",
    makeItHotter: "The giving partner can reach around to the front with one hand while keeping the rhythm going — the position naturally leaves it accessible. Try going painfully slow, then building, then pulling back again.",
  },
  ip016: {
    howTo: "The giving partner sits and leans back slightly, legs extended or loosely bent. The receiving partner reclines against them at a perpendicular angle — bodies forming an L-shape, connected at the hips. The giving partner's hands rest on their partner's hips or thighs. Neither partner holds anything up — both just settle in.",
    benefits: "The semi-reclined angle removes effort for both partners — no one is holding their weight, and the bodies naturally sink together. There's a deeply relaxed quality to this position that lets both partners focus entirely on sensation rather than staying in place.",
    makeItHotter: "The giving partner is right at their partner's neck from behind — slow kisses, breath on the back of the neck, or teeth along the shoulder turn this into something far less quiet than the name suggests.",
  },
  ip017: {
    howTo: "The receiving partner bends all the way forward — hands on the floor for support, hips elevated. The giving partner kneels close behind them, hands gripping their partner's hips or waist. The steep forward angle creates a deep, gravity-assisted connection.",
    benefits: "Bending all the way forward shifts the body into a steep downward angle that intensifies everything. The giving partner is fully in control from their kneeling position, with nothing between them. The receiving partner is completely open, surrendered, and at exactly the right angle.",
    makeItHotter: "Try having the receiving partner put their hands on their lower back — wrists crossed — instead of reaching for the floor. It changes the dynamic entirely and deepens the sense of surrender.",
  },
};

data.items = data.items.map(pos => {
  const rw = rewritten[pos.id];
  if (!rw) return pos;

  const { setup, whyItWorks, variants, focus, ...rest } = pos;

  return {
    ...rest,
    focus,
    howTo: rw.howTo,
    benefits: rw.benefits,
    makeItHotter: rw.makeItHotter,
  };
});

// Update meta
delete data.meta.inclusivity;
delete data.meta.variants;
data.meta.description = "Intimacy building positions for all couples. Premium-only with weekly releases.";

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Done. Positions rewritten:', data.items.length);

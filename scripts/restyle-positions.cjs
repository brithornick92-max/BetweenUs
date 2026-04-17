const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const rewritten = {
  ip001: {
    howTo: "The giver sits on the floor with one leg bent and one extended in front of them. The receiver climbs into their lap facing away, then arches their entire upper body backward — spine opening wide, arms spreading out, face tilting toward the ceiling. The giver wraps both arms around from behind to support them through the arch.",
    benefits: "If you love the feeling of being completely open and exposed, this one is for you. The backward arch puts the receiver's chest and throat on full display, and the angle creates deep, satisfying pressure. The fact that you're not facing each other adds a layer of intensity — you feel everything without being able to read each other's faces.",
    makeItHotter: "As the receiver arches back, their chest is completely within reach. The giver can run both hands slowly up the torso, trace the throat, and pay some attention to the nipples — from this angle, even light touch is felt deeply.",
  },
  ip002: {
    howTo: "The giver sits with legs extended. The receiver sits between their legs facing away, then arches their upper body all the way backward — spine curving open, face pointing toward the ceiling, arms falling softly to the sides. The giver wraps both arms around the receiver's front and holds them steady through the arch.",
    benefits: "The dramatic backward lean puts the receiver in a full state of surrender — chest open, throat exposed, completely held by their partner. It's an intensely trusting position, and that trust tends to amplify everything else. The angle builds slowly and rewards patience.",
    makeItHotter: "The giver's mouth lands right at the receiver's neck and shoulders. Slow kisses, light biting along the side of the neck, or whispering directly into their ear while they arch back turns the physical sensation into full sensory overload.",
  },
  ip003: {
    howTo: "The giver lies back comfortably. The receiver straddles them facing their feet, sitting fully upright, and lowers themselves down. Hands can rest on the giver's shins or the bed for balance. From here, the receiver bounces, grinds, or rolls their hips — whatever feels best.",
    benefits: "Flipping around completely changes the angle, which means new nerve endings, new pressure points, and a completely different experience from the same connection. The receiver is totally in control of pace and depth. And for receivers who enjoy G-spot or P-spot stimulation, the reversed angle hits differently — often better.",
    makeItHotter: "Position a mirror in front of you so both partners can see each other's reactions in real time. The receiver can also reach back and grip their partner's thighs, pulling them in whenever they want more.",
  },
  ip004: {
    howTo: "The receiver gets on their hands and knees. The giver kneels behind them, resting their hands on the receiver's hips or lower back. Both find a rhythm together — the giver can pull the receiver in, the receiver can push back, or you can just let it build naturally.",
    benefits: "This position allows for deep penetration and puts the giver in full control of the pace — which some receivers find incredibly freeing. You feel your partner completely without seeing their face, which creates its own kind of intensity. It's also one of the best angles for stimulating the G-spot or P-spot, depending on the tilt of the hips.",
    makeItHotter: "The receiver reaches one hand back and guides the giver's hand wherever they want it. Or the giver wraps an arm around to the front — adding direct stimulation without breaking the rhythm.",
  },
  ip005: {
    howTo: "The giver sits and leans back onto both hands, lifting their hips off the ground into a reverse tabletop. The receiver straddles them facing forward and lowers down. The receiver can sit upright or arch their own body dramatically backward — both partners find their balance together.",
    benefits: "The lifted hips create a unique angle that you genuinely can't replicate lying flat. For the receiver, the tilt often means more direct pressure in exactly the right spot. It takes a few seconds to find your footing together, but once you do, it's completely worth it. Both partners tend to feel more sensation from less movement.",
    makeItHotter: "The giver is essentially pinned in place — which means the only job is to enjoy the view. The receiver can slow all the way down, hold at the deepest point, and decide exactly when to move again.",
  },
  ip006: {
    howTo: "The giver lies back. The receiver straddles them facing away, then slowly leans all the way back until their spine rests flat against the giver's chest. The giver wraps both arms around from behind. Both bodies settle into a full-length embrace and find their rhythm from there.",
    benefits: "What looks like a simple position swap becomes something unexpectedly intimate once you're fully leaned in. The giver holds the receiver from every side — chest, arms, hips — while the reversed angle creates deep, satisfying pressure. It's equal parts closeness and sensation, which is a hard combination to beat.",
    makeItHotter: "Once fully leaned back, both sets of hands are completely free. Explore each other freely, add a toy, or have the receiver reach back and grip the giver's thighs — pulling them in whenever they want to feel more.",
  },
  ip007: {
    howTo: "The receiver gets on their knees and lowers down to their forearms, resting their head on their folded arms. The giver kneels over them from behind, pressing their chest toward the receiver's back with hands placed on either side. Both bodies align from knees to shoulders — fully stacked.",
    benefits: "The forearm position tilts the receiver's hips in a way that deepens everything significantly. For receivers who enjoy deep penetration, this is one of the best angles available — and the full-body overlay from the giver adds a primal sense of being completely covered that's hard to find elsewhere. Every movement is felt across the whole body.",
    makeItHotter: "The giver is right at the receiver's ear — whisper exactly what you're feeling in real time. Even the smallest movements are amplified by the closeness; try barely moving at all and just breathing together to see how quickly the tension builds.",
  },
  ip008: {
    howTo: "The giver lies on their back. The receiver straddles their pelvis, lowers themselves down, and takes control — bouncing, grinding, rolling their hips forward and back, or whatever combination feels best. The giver's hands are completely free.",
    benefits: "If you're a receiver who likes to control the depth, speed, and angle, this position is made for you. You set the pace, you decide how deep, and you find the exact angle that hits right. It also offers excellent G-spot access — try leaning slightly forward to dial that in. The giver gets to experience the rare pleasure of fully letting go and being ridden.",
    makeItHotter: "Lock eyes and hold contact — no looking away. The receiver can slow to an almost complete stop, holding at the deepest point, and use the pause itself as a form of touch. Then decide when to move again.",
  },
  ip009: {
    howTo: "The receiver lies flat on their stomach. The giver kneels over them from behind, leaning forward with arms wrapped around, body curled close. Movement is slow and minimal — this one is about warmth and sustained closeness, not pace.",
    benefits: "The kneeling position keeps the giver close and enveloping without putting their full weight on their partner. Think of it as the intimate version of being held from behind — a full-body cocoon. It's perfect for slow mornings or late nights when you want to feel completely close without any effort.",
    makeItHotter: "The giver reaches one arm all the way around to the front, making the receiver feel completely surrounded. Keep everything barely moving — focused on breath and warmth rather than rhythm — and see how long you can stay in it.",
  },
  ip010: {
    howTo: "The receiver lies on their back. The giver lowers on top of them, chest to chest, resting their weight on their forearms. Faces are close enough to kiss, whisper, and hold eye contact the entire time. Move together from there — slow tends to work best.",
    benefits: "There's a reason this is still one of the most popular positions — the full frontal body contact, easy eye contact, and natural kissing access create a closeness that's hard to replicate anywhere else. It's also a great angle for clitoral stimulation through grinding, and the face-to-face position means your breath, sounds, and expressions are fully shared. Slowing it down makes it feel completely new.",
    makeItHotter: "Press your foreheads together and breathe in sync — breath for breath. Try going so slow you're barely moving at all, just feeling the pressure and warmth between you, and see how long you can hold it before it becomes impossible.",
  },
  ip011: {
    howTo: "The giver stands and lifts their partner completely off the ground. The receiver wraps their legs around the giver's waist and holds on with their arms around their shoulders. Step back against a wall — it takes most of the effort out of holding the position and lets both partners relax into it.",
    benefits: "Being lifted completely off the ground creates a kind of vulnerability you can't fake or rush — there's nowhere to brace, nothing to hold onto except your partner. The face-to-face height puts you eye to eye in a way that only happens in this position, and that closeness intensifies everything. It's equal parts trust and adrenaline.",
    makeItHotter: "With the wall taking the weight, the giver's hands are free. Use them — the receiver is right there at chest height, completely accessible. The receiver can tilt their hips to adjust the angle and find exactly what they need.",
  },
  ip012: {
    howTo: "The receiver gets on all fours at the edge of a bed or surface, then raises one leg straight up — nearly vertical. The giver kneels behind them, supporting the raised leg with both hands. How high the giver holds the leg directly controls the depth and angle, so both partners can communicate and adjust in real time.",
    benefits: "Raising one leg straight up opens the hip in a way that creates one of the deepest penetration angles available in any rear-entry position. For the giver, a tiny adjustment in how high you hold the leg makes an immediate, significant difference in sensation for both of you. It's a position that rewards communication — the more you talk through it, the better it gets.",
    makeItHotter: "Ask your partner to tell you the exact moment you hit the right angle — then stay there and don't move. Try dropping the leg slightly to feel the shift, then raising it back up and watching the difference.",
  },
  ip013: {
    howTo: "The receiver lies on their back with hips right at the edge of the bed, then lets their upper body hang off the edge — arms reaching toward the floor for support. The giver stands between their legs and holds their hips or thighs to keep them stable. The receiver's legs can rest on the giver's shoulders or stay loose.",
    benefits: "When the head is lower than the heart, blood rushes there — and that increases sensitivity across the entire body. Receivers often report that this inversion makes every sensation feel sharper and more immediate. The giver has full control of pace and depth from the standing position, while the receiver is in a completely open, surrendered state.",
    makeItHotter: "The receiver should take slow, steady breaths and let the head-rush build gradually rather than fighting it. That altered state amplifies everything. The giver can vary the pace significantly — slowing almost to a stop, then building again — to draw it out.",
  },
  ip014: {
    howTo: "The giver stands with their arms ready. The receiver steps in close, wraps their legs around the giver's hips, and holds on around their neck or shoulders. Back up against a wall so the giver can brace — from there, both bodies are free to move together without worrying about balance.",
    benefits: "Standing face-to-face with no surface between you brings every part of your bodies into contact at once. The wrap keeps everything pressed close, and the upright angle means your faces are level and right there — close enough to kiss with every movement. It's immediate, physical, and intimate all at once.",
    makeItHotter: "With the wall behind the giver, both sets of hands are completely free — use them. The receiver can adjust their angle by tilting their hips forward or back to find exactly the pressure they want, and communicate it.",
  },
  ip015: {
    howTo: "The receiver starts on all fours, then lowers down to their forearms with their forehead resting on their folded arms. The giver kneels behind them. That's it — the drop to forearms does most of the work, changing the angle immediately and completely.",
    benefits: "Dropping to the forearms is the fastest way to go deeper without changing positions — it tilts the hips and opens up an angle that's genuinely hard to reach any other way. No extra flexibility required, just the willingness to sink lower and surrender to it. Receivers often find this one of the most intense rear-entry variations for G-spot or P-spot stimulation.",
    makeItHotter: "The giver reaches around to the front with one hand while maintaining the rhythm — the position leaves it perfectly accessible. Try slowing all the way down, then building, then pulling back, then building again. The anticipation tends to take over.",
  },
  ip016: {
    howTo: "The giver sits and leans back slightly, legs extended or loosely bent. The receiver lies back against them at a perpendicular angle, bodies forming a loose L-shape and connecting at the hips. The giver rests their hands on the receiver's hips or thighs. Neither partner has to hold anything up — both just settle in together.",
    benefits: "This is the position for when you want deep, satisfying closeness without any effort. The semi-reclined angle means no one is holding their weight — both bodies just sink into each other. The sideways angle creates a different kind of pressure than anything head-on, and the relaxed state it puts you both in tends to make everything feel more.",
    makeItHotter: "The giver is positioned right behind the receiver's neck and shoulders — use that access. Slow kisses, a little teeth along the shoulder, breathing against the back of the neck — it turns this quiet position into something that builds fast.",
  },
  ip017: {
    howTo: "The receiver bends all the way forward — hands flat on the floor for support, hips lifted high. The giver kneels close behind them, gripping their hips or waist. The steep forward fold creates a deep, gravity-assisted angle that both partners can feel immediately.",
    benefits: "Bending all the way forward naturally deepens the angle, and gravity does the rest. For the giver, it's a position of total control — the receiver is fully open and the approach is completely unobstructed. For receivers who enjoy deep penetration and a sense of complete surrender, this delivers both at once.",
    makeItHotter: "Have the receiver place their hands on their lower back — wrists crossed — instead of reaching for the floor. It deepens the surrender and changes the dynamic noticeably. The giver controls everything from there.",
  },
};

data.items = data.items.map(pos => {
  const rw = rewritten[pos.id];
  if (!rw) return pos;
  return { ...pos, howTo: rw.howTo, benefits: rw.benefits, makeItHotter: rw.makeItHotter };
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Done. Rewrote', data.items.length, 'positions.');

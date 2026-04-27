const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/intimacy-positions.json must have an items array');
}

const patches = {
  ip152: {
    focus: 'A tell-me-more touch position where feedback becomes part of the intimacy instead of an interruption. One partner offers touch while the other responds with simple guidance, making the moment playful, curious, and emotionally safe.',
    benefits: 'This position makes communication feel lighter and easier. It helps partners learn what feels good in real time while keeping the mood flirtatious instead of overly serious.',
    makeItHotter: 'Use short cues like more, softer, slower, warmer, or stay there. The simplicity keeps the moment from becoming a conversation while still making the touch feel personalized.',
    comfort: 'Choose a relaxed position where both partners can reach comfortably. If giving feedback feels awkward, start with yes/no cues or hand-guided direction instead of words.',
    whyPeopleLikeIt: 'It feels playful and communicative. Many couples like it because it turns feedback into connection rather than pressure.',
    shortSummary: 'A playful touch-and-feedback position that helps partners guide each other with curiosity and ease.'
  },

  ip153: {
    focus: 'A couch straddle with mischievous, flirty energy. One partner sits while the other comes close in their lap, using the casual couch setting to make the moment feel spontaneous, playful, and a little bold.',
    benefits: 'The couch gives this position a relaxed structure while the straddle adds spark and direct attention. It works well for couples who want the mood to feel fun before it becomes more heated.',
    makeItHotter: 'Use playful rules, teasing pauses, or a slow shift from laughter into eye contact. The position works best when it keeps a little mischief instead of becoming too serious too quickly.',
    comfort: 'Make sure the seated partner has back support and the top partner has knees or feet placed comfortably. Add a cushion if the couch angle makes the hips feel awkward.',
    whyPeopleLikeIt: 'It feels casual, fun, and charged. Many people like it because the couch setup makes the closeness feel spontaneous instead of overly planned.',
    shortSummary: 'A playful couch straddle for mischievous closeness, teasing, and easy lap-based connection.'
  },

  ip154: {
    focus: 'A come-sit-with-me position built around invitation and closeness. One partner creates a welcoming lap, side seat, or close cuddle space, while the other chooses how near they want to come.',
    benefits: 'This position makes desire feel invited rather than demanded. It can feel especially sweet because one partner offers closeness and the other gets to actively accept it.',
    makeItHotter: 'Let the invitation be slow and clear. A hand offered, a gentle pull closer, or a whispered “come here” can make the position feel intimate before much movement happens.',
    comfort: 'Use a couch, bed, chair, or floor setup that supports both partners. The invited partner should feel free to adjust distance and angle so the closeness feels chosen.',
    whyPeopleLikeIt: 'It feels wanted and low-pressure. Many couples like it because the position makes the act of being invited close feel romantic and playful.',
    shortSummary: 'An invitation-based closeness position where one partner offers space and the other chooses to come near.'
  },

  ip155: {
    focus: 'A timed touch game where partners use short rounds to explore touch, closeness, and anticipation. The structure keeps it playful while still making each round feel focused and intentional.',
    benefits: 'The timer makes intimacy feel like a shared game instead of a guessing process. It creates variety, lowers awkwardness, and gives both partners natural moments to pause, switch, or ask for more.',
    makeItHotter: 'Use short rounds at first, then extend the ones that feel best. Try themes like only hands, only slow touch, only kissing, or one partner leads for one minute.',
    comfort: 'Keep the setup simple and supported so the game stays fun. If either partner feels rushed by the timer, turn it into a loose cue instead of a strict rule.',
    whyPeopleLikeIt: 'It feels playful and structured. Many people like it because the game format makes exploration feel lighter and easier to start.',
    shortSummary: 'A timed touch game that makes closeness playful, structured, and easy to take turns with.'
  },

  ip156: {
    focus: 'A light touch trail where one partner slowly traces a path across the other’s body. The position can be side-lying, seated, or reclined, with the focus on anticipation, attention, and subtle response.',
    benefits: 'Light touch can make the body feel noticed in a different way than stronger contact. It creates a quiet build and helps partners pay attention to small reactions, breath, and tension.',
    makeItHotter: 'Move slower than feels natural and repeat the areas that get the strongest response. A whispered cue or brief pause can make the touch trail feel even more charged.',
    comfort: 'Avoid ticklish or overstimulating areas unless both partners enjoy that. If light touch feels irritating, use broader contact through the palm instead of fingertips.',
    whyPeopleLikeIt: 'It feels teasing and attentive. Many couples like it because the slow touch creates anticipation without requiring a complicated position.',
    shortSummary: 'A light touch trail position for slow teasing, body awareness, and gentle anticipation.'
  },

  ip157: {
    focus: 'A confident top-partner pose where the partner above gets to feel seen, expressive, and in control. The position centers presence and confidence as much as physical rhythm.',
    benefits: 'This position can help the partner on top feel powerful and desired while still staying connected to the partner below. It creates room for eye contact, posture changes, and self-directed movement.',
    makeItHotter: 'Let the top partner choose the pace, posture, and level of closeness. A slow reveal, bold eye contact, or deliberate pause can make the confidence feel stronger than speed.',
    comfort: 'Use hands on the bed, thighs, or partner’s body for balance. If knees or thighs tire, lean forward, lower the pace, or switch to a more supported version.',
    whyPeopleLikeIt: 'It feels empowering and visually connected. Many people like it because the partner on top can lead while still receiving attention and support.',
    shortSummary: 'A confident top-partner position centered on being seen, leading, and moving with control.'
  },

  ip158: {
    focus: 'A repeat-favorite position that turns a known good setup into an intentional encore. Instead of chasing novelty, partners return to something that already works and make it feel chosen again.',
    benefits: 'Repeating a favorite can build confidence, comfort, and anticipation. It reminds couples that intimacy does not always need to be new to feel meaningful or exciting.',
    makeItHotter: 'Repeat the favorite position but change one detail: lighting, pace, hand placement, music, or who leads. Keeping the base familiar makes the new detail easier to notice.',
    comfort: 'Choose a favorite that both partners genuinely enjoy and can hold comfortably. Do not repeat a position just because it used to work if one body or mood needs something different now.',
    whyPeopleLikeIt: 'It feels reliable and personal. Many couples like it because returning to a favorite can feel like speaking a private language together.',
    shortSummary: 'An intentional encore of a favorite position, refreshed with one small new detail.'
  },

  ip159: {
    focus: 'A supported recline for moments of surrender, softness, and being received with care. One partner rests back into pillows or a stable surface while the other stays close and attentive.',
    benefits: 'The supported shape allows the reclining partner to let go without feeling physically exposed or strained. It can feel vulnerable in a calm way because the body is open but still held by support.',
    makeItHotter: 'Move slowly and let the receiving partner stay relaxed. A hand at the heart, waist, thigh, or cheek can make the position feel more emotionally present.',
    comfort: 'Support the neck, back, hips, and knees before building intensity. If openness starts to feel uncomfortable, adjust the angle or add more coverage and grounding touch.',
    whyPeopleLikeIt: 'It feels safe and receptive. Many people like it because the support makes vulnerability feel easier to stay with.',
    shortSummary: 'A supported recline for soft surrender, attentive closeness, and grounded vulnerability.'
  },

  ip160: {
    focus: 'A lifted-leg support position where one partner holds or steadies the other’s leg to create a more open, focused angle. The support makes the shape feel guided rather than forced.',
    benefits: 'The held leg creates a stronger line of contact while keeping the receiving partner from having to hold the shape alone. It can feel intimate because the support itself becomes part of the connection.',
    makeItHotter: 'Adjust the lifted leg slowly and notice how small changes affect the angle. Holding the leg with both firmness and care can make the position feel more secure and charged.',
    comfort: 'Never force the leg higher than it wants to go. Bend the knee, lower the leg, or support it with a pillow if the hip or hamstring feels strained.',
    whyPeopleLikeIt: 'It feels focused and held. Many couples like it because the support creates intensity while still feeling attentive.',
    shortSummary: 'A lifted-leg position where careful support creates openness, angle, and connected control.'
  },

  ip161: {
    focus: 'A back-to-chest hold inspired by the feeling of being caught, supported, and safely leaned into. One partner rests back against the other while both bodies settle into trust and steady contact.',
    benefits: 'This position creates a strong sense of being held from behind without needing high intensity. It can feel protective, calming, and emotionally secure.',
    makeItHotter: 'Let the partner behind guide breath, pressure, or gentle touch. A hand over the heart, stomach, or hip can make the hold feel more intimate.',
    comfort: 'Keep the leaned-back partner supported enough that they are not balancing or collapsing. Use a wall, couch, bed, or pillows if sitting upright becomes tiring.',
    whyPeopleLikeIt: 'It feels protective and grounding. Many people like it because the behind-the-body hold creates trust without demanding much movement.',
    shortSummary: 'A back-to-chest trust hold for being supported, gathered, and safely leaned into.'
  },

  ip162: {
    focus: 'A guided-hands position where partners use their hands to show, invite, and respond. Instead of guessing, one partner can place or guide the other’s hand with care, making the moment collaborative.',
    benefits: 'This position makes communication physical and immediate. It helps partners learn each other’s preferences while keeping the mood intimate and connected.',
    makeItHotter: 'Guide slowly and leave room for the other partner to respond. A hand-over-hand moment can feel especially intimate when it is gentle, deliberate, and clearly welcomed.',
    comfort: 'Keep the guidance light and easy to refuse or change. If either partner feels self-conscious, start with neutral areas like arms, waist, back, or shoulders.',
    whyPeopleLikeIt: 'It feels collaborative and clear. Many couples like it because hand guidance can communicate desire without needing perfect words.',
    shortSummary: 'A guided-hands position that turns touch, direction, and feedback into shared intimacy.'
  },

  ip163: {
    focus: 'A covered shelter position where one partner partially drapes over or wraps around the other, creating warmth, weight, and a sense of protection. It feels like being tucked in by the body itself.',
    benefits: 'The covering shape can feel emotionally regulating and deeply secure. It works well when partners want closeness that feels protective rather than performative.',
    makeItHotter: 'Use weight carefully. A little pressure through the chest, hip, or arm can feel grounding, while slow breath and stillness can make the covered feeling more intimate.',
    comfort: 'Check that the covered partner can breathe and move freely. Use pillows or shift weight to avoid pressure on the chest, neck, joints, or stomach.',
    whyPeopleLikeIt: 'It feels safe and enveloping. Many people like it because the covered feeling creates comfort, trust, and quiet closeness.',
    shortSummary: 'A protective covered hold that uses warmth, body weight, and softness to create safety.'
  },

  ip164: {
    focus: 'A slow consent pause that makes checking in part of the position itself. Partners come close, pause, and let the next movement happen only after both bodies and voices feel aligned.',
    benefits: 'This position helps consent feel warm and connected rather than clinical. It gives both partners room to notice desire, hesitation, comfort, and readiness before continuing.',
    makeItHotter: 'Use a simple phrase like “more,” “slower,” “stay,” or “not yet.” The clarity can make the moment feel safer, and safety often makes desire easier to access.',
    comfort: 'Pause in a position that can be held comfortably. If either partner feels pressured by the pause, soften the contact, add space, or shift into a cuddle first.',
    whyPeopleLikeIt: 'It feels respectful and intimate. Many couples like it because the check-in creates trust without breaking the mood.',
    shortSummary: 'A slow consent-based pause that makes readiness, comfort, and desire part of the intimacy.'
  },

  ip165: {
    focus: 'A fully supported back recline for release, rest, and being cared for. One partner lies back into pillows or a stable surface while the other stays close enough to offer touch, warmth, and reassurance.',
    benefits: 'The supported recline gives the body permission to soften. It can be especially helpful when one partner wants to receive attention without also managing posture or balance.',
    makeItHotter: 'Keep the receiving partner grounded with a hand at the waist, chest, thigh, or face. Slow attention and steady support can make the openness feel more intense.',
    comfort: 'Support the neck, lower back, hips, and knees before adding more closeness. If the recline feels too open, bring the knees closer together or add a blanket for coverage.',
    whyPeopleLikeIt: 'It feels restful and attentive. Many people like it because the body can relax while still feeling fully included in the moment.',
    shortSummary: 'A fully supported back recline for receiving care, relaxing the body, and staying close.'
  },

  ip166: {
    focus: 'A wall-supported embrace where the wall creates steadiness and the bodies create warmth. One or both partners lean into the wall while staying close through the chest, hips, arms, or hands.',
    benefits: 'The wall support makes upright closeness easier to hold. It can feel spontaneous and intimate without requiring the balance or strength of a more athletic standing position.',
    makeItHotter: 'Use the wall as an anchor for a slow kiss, a closer pull, or a pause with the bodies pressed together. Keeping the movement small can make the upright contact feel stronger.',
    comfort: 'Make sure pressure against the wall feels comfortable. If shoulders, back, or hips feel strained, change the angle or move into a seated version.',
    whyPeopleLikeIt: 'It feels spontaneous but supported. Many couples like it because the wall creates security while the upright hold keeps the energy alive.',
    shortSummary: 'A wall-supported embrace for upright closeness, steadiness, and spontaneous warmth.'
  },

  ip167: {
    focus: 'A check-in position where partners stay close while naming what feels good, what needs to slow down, and what should pause. The position turns communication into care rather than interruption.',
    benefits: 'This position helps make safety part of the erotic and emotional connection. It gives both partners an easy structure for staying attuned before discomfort builds.',
    makeItHotter: 'Use check-ins as invitations, not just safety stops. Phrases like “stay there,” “softer,” or “more like that” can make the moment feel more personal.',
    comfort: 'Keep the body position simple enough that either partner can speak or signal clearly. Agree on a pause word, gesture, or touch cue before continuing.',
    whyPeopleLikeIt: 'It feels safe and connected. Many couples like it because clear check-ins allow the moment to deepen without guessing.',
    shortSummary: 'A close check-in position that keeps safety, feedback, and desire connected.'
  },

  ip168: {
    focus: 'An eye-contact stillness position where one partner witnesses the other with calm attention. The bodies stay close, but the gaze and pause create the emotional center.',
    benefits: 'Being seen can make intimacy feel more vulnerable and meaningful. This position gives partners a way to practice presence without needing more movement or intensity.',
    makeItHotter: 'Hold eye contact for a few breaths, then add one slow touch or kiss. The contrast between stillness and contact can make the moment feel more charged.',
    comfort: 'If direct eye contact feels too intense, soften it by looking at the face, closing the eyes, or resting foreheads together. The goal is presence, not pressure.',
    whyPeopleLikeIt: 'It feels emotionally honest. Many people like it because the gaze creates connection without needing a complicated physical shape.',
    shortSummary: 'An eye-contact stillness hold for being seen, staying present, and deepening trust.'
  },

  ip169: {
    focus: 'A one-partner-directs position where guidance is explicit, confident, and responsive. The directing partner leads pace, angle, or touch while staying attentive to the other partner’s comfort and cues.',
    benefits: 'Clear direction can feel exciting when it is grounded in trust. It gives the moment a strong shape while still making feedback and adjustment part of the connection.',
    makeItHotter: 'Let the directing partner choose one focus at a time, such as slower pace, closer hips, guided hands, or stillness. Simplicity makes the dynamic feel more confident.',
    comfort: 'Direction should always remain flexible. Use a pause signal and keep checking that the guided partner feels included, not overridden.',
    whyPeopleLikeIt: 'It feels confident and trust-based. Many couples like it because one partner leading clearly can reduce guessing and heighten anticipation.',
    shortSummary: 'A trust-based guided position where one partner directs pace, touch, or angle with care.'
  },

  ip170: {
    focus: 'A gentle restraint-inspired hold that borrows the feeling of containment without needing anything harsh or complicated. One partner may hold wrists, hands, hips, or body position lightly while the other relaxes into the boundary.',
    benefits: 'The soft edge can create anticipation and focus while still feeling safe and affectionate. It gives partners a way to explore contained energy with clarity and care.',
    makeItHotter: 'Keep the restraint symbolic and responsive. A light wrist hold, pinned hands above the head, or steady hip hold can feel intense when paired with slow pacing and clear consent.',
    comfort: 'Agree on boundaries before beginning and keep the hold easy to release. Avoid pressure on joints, and stop immediately if the contained feeling stops being enjoyable.',
    whyPeopleLikeIt: 'It feels focused and exciting. Many people like it because a gentle boundary can heighten attention without making the moment feel unsafe.',
    shortSummary: 'A soft restraint-inspired hold for containment, anticipation, and careful trust.'
  },

  ip171: {
    focus: 'A protective spooning position where the partner behind takes on a steady, keeper-like hold. The front partner is wrapped with warmth and care while both bodies settle into slow, secure contact.',
    benefits: 'This position can feel emotionally grounding because the behind-the-body contact is steady and reassuring. It works well for couples who want trust, tenderness, and low-effort closeness.',
    makeItHotter: 'Use one strong point of contact, like a hand over the heart, around the waist, or along the thigh. Keeping the hold calm can make it feel more intimate than adding a lot of motion.',
    comfort: 'Keep the front partner’s shoulders, hips, and knees supported. If the hold feels too tight, loosen the arms while staying close through the hips or back.',
    whyPeopleLikeIt: 'It feels protective and soothing. Many couples like it because the wrapped shape creates safety while still allowing sensual closeness.',
    shortSummary: 'A protective spooning hold that feels steady, warm, and emotionally secure.'
  },

  ip172: {
    focus: 'A hands-interlaced missionary variation where handholding becomes the anchor for closeness. The face-to-face shape stays familiar, but joined hands add tenderness, focus, and a sense of being fully chosen.',
    benefits: 'The handhold gives both partners a simple way to stay connected through movement, pauses, and eye contact. It can make a familiar position feel more romantic and emotionally clear.',
    makeItHotter: 'Try holding hands beside the head, against the bed, or between the bodies. Small changes in where the hands connect can shift the position from sweet to more intense.',
    comfort: 'Keep the handhold relaxed enough that shoulders and wrists do not strain. The partner above should still support their weight so the hands feel connecting, not trapped.',
    whyPeopleLikeIt: 'It feels romantic and grounding. Many people like it because the handhold keeps both partners emotionally present inside a familiar position.',
    shortSummary: 'A hands-interlaced face-to-face position that adds tenderness, presence, and connection.'
  },

  ip173: {
    focus: 'A reclined pillow-support position for letting go while staying physically and emotionally held. One partner rests back into support while the other stays near, attentive, and responsive.',
    benefits: 'The pillows help the receiving partner relax without feeling exposed or unsupported. It can create a calm, receptive mood where closeness feels cared for rather than effortful.',
    makeItHotter: 'Use slow, grounding contact at the waist, thigh, chest, or cheek. The more supported the body feels, the easier it can be to let the moment build.',
    comfort: 'Adjust pillow height before adding more intensity. Support the neck, lower back, hips, and knees so the body can release instead of brace.',
    whyPeopleLikeIt: 'It feels soft and supportive. Many couples like it because the position makes letting go feel safe and physically comfortable.',
    shortSummary: 'A reclined pillow-supported position for soft release, comfort, and attentive closeness.'
  },

  ip174: {
    focus: 'A hip-held trust position where one partner’s hands stabilize and guide the other through the hips. The hold creates a clear sense of support, direction, and physical confidence.',
    benefits: 'Hands at the hips can make the position feel more secure and responsive. It gives both partners a shared language for pace, pressure, and closeness without needing constant verbal direction.',
    makeItHotter: 'Use the hip hold to slow down, pull closer, or pause with intention. A steady hold can feel more intense than faster movement when both partners trust it.',
    comfort: 'Keep the grip supportive rather than forceful. If hip pressure feels uncomfortable, shift the hands to the waist, lower back, or thighs.',
    whyPeopleLikeIt: 'It feels secure and guided. Many people like it because the hip hold makes the rhythm feel clear, confident, and connected.',
    shortSummary: 'A hip-held position where steady hands guide pace, support, and trust.'
  },

  ip175: {
    focus: 'A legs-supported open position that creates vulnerability through openness while keeping the body carefully held. One partner’s legs are supported by hands, shoulders, pillows, or the surface so the shape feels safe and sustainable.',
    benefits: 'The supported openness can create a strong angle and a strong emotional feeling at the same time. It invites trust because the receiving partner does not have to hold the position alone.',
    makeItHotter: 'Adjust the leg support slowly and keep checking comfort through the hips and lower back. A steady hand at the thigh or calf can make the openness feel more cared for.',
    comfort: 'Do not push the legs wider or higher than they naturally want to go. Use pillows, bent knees, or lower leg placement if the stretch feels too intense.',
    whyPeopleLikeIt: 'It feels open and supported. Many couples like it because the position creates intensity while still making care and support visible.',
    shortSummary: 'A legs-supported open position for trust, careful support, and focused intensity.'
  },

  ip176: {
    focus: 'A vulnerable face-to-face hold that creates a brave little space for honesty, closeness, and being seen. The bodies stay supported while both partners remain near enough for eye contact, touch, and quiet reassurance.',
    benefits: 'This position works well when intimacy needs emotional safety as much as physical closeness. It gives partners a way to stay open without feeling rushed or exposed beyond their comfort.',
    makeItHotter: 'Use a simple check-in or whispered reassurance before adding movement. The emotional clarity can make the physical closeness feel deeper and more grounded.',
    comfort: 'Choose a supported setup, such as side-lying, reclined, or seated with back support. If face-to-face vulnerability feels intense, soften it with forehead contact or closed eyes.',
    whyPeopleLikeIt: 'It feels honest and reassuring. Many people like it because the position makes emotional openness feel physically supported.',
    shortSummary: 'A vulnerable face-to-face hold for brave closeness, reassurance, and emotional safety.'
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

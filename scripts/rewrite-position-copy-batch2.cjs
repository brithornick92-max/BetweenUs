const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/intimacy-positions.json must have an items array');
}

const patches = {
  ip076: {
    focus: 'A slow face-to-face rocking position where the rhythm stays close, shallow, and emotionally tuned in. The bodies remain near enough for kissing, touch, and breath while the movement comes from a gentle pulse through the hips. It feels intimate without needing a lot of speed or range.',
    benefits: 'This position works well when both partners want sensual rhythm without losing the softness of face-to-face closeness. The smaller movement can make each shift feel more noticeable, and the steady contact helps both partners stay responsive to pressure and pace.',
    makeItHotter: 'Keep the rocking small and deliberate. A hand at the lower back, hip, or chest can help guide the pulse, and slowing down for a few breaths can make the return to movement feel more charged.',
    comfort: 'Use forearm or pillow support so the partner above does not carry too much weight. If the lower back feels compressed, reduce the arch, soften the legs, or place a small pillow under the hips.',
    whyPeopleLikeIt: 'It feels intimate and easy to stay inside. Many couples like it because the motion is simple, the closeness stays constant, and the rhythm can be adjusted without breaking the connection.',
    shortSummary: 'A slow face-to-face rocking position built around close rhythm, breath, and steady contact.'
  },

  ip077: {
    focus: 'A seated embrace that begins like a full-body hug and slowly becomes more intimate. One partner sits supported while the other settles into their lap, creating a held, attentive shape with plenty of room for eye contact, kissing, and small hip movements.',
    benefits: 'The seated base gives the position structure while still feeling emotionally close. It can feel especially good when both partners want support, warmth, and a sense of being fully gathered together.',
    makeItHotter: 'Let the embrace stay central. Wrap the arms fully around each other, stay close through the chest, and use small rocking or circling motions instead of pulling apart for a bigger rhythm.',
    comfort: 'Support the seated partner’s back with a wall, couch, or headboard. If the top partner’s knees or hips tire, add pillows under the legs or shift into a more reclined lap hold.',
    whyPeopleLikeIt: 'It feels caring and mutual. Many people like it because the position creates a natural hug, making the physical rhythm feel connected rather than separate from emotional closeness.',
    shortSummary: 'A supported seated embrace that feels attentive, warm, and deeply connected.'
  },

  ip078: {
    focus: 'A soft side-lying leg wrap that keeps the bodies close while opening the angle just enough for gentle rhythm. The top leg becomes a point of connection, resting over the other partner’s hip or thigh while the upper bodies stay relaxed and near.',
    benefits: 'This position is low-effort but still intimate. It gives partners a way to stay face-to-face, keep eye contact or kissing available, and adjust sensation with small changes in the lifted leg.',
    makeItHotter: 'Use the leg wrap to draw the bodies closer for a few breaths, then soften it again. The contrast between held closeness and relaxed space can make the position feel more intentional.',
    comfort: 'Keep pillows under the head and between the knees if needed. If the lifted hip feels tight, lower the leg or rest it across the thigh instead of the waist.',
    whyPeopleLikeIt: 'It feels gentle and connected without requiring much effort. Many couples like it because the position can stay soft while still feeling intimate and physically linked.',
    shortSummary: 'A side-lying leg-wrap position for soft face-to-face closeness and gentle rhythm.'
  },

  ip079: {
    focus: 'A hands-held face-to-face position where the handhold becomes the emotional anchor. The bodies stay close in a familiar shape while interlaced fingers add tenderness, focus, and a sense of choosing each other in the moment.',
    benefits: 'Holding hands can make a simple position feel more intimate and emotionally clear. It gives both partners a subtle way to communicate pressure, closeness, pauses, and reassurance without needing many words.',
    makeItHotter: 'Press the hands into the bed, hold them between the bodies, or bring them beside the face. Changing where the hands connect can shift the feeling from sweet to more intense while keeping the same basic position.',
    comfort: 'Make sure the handhold does not trap either partner’s shoulders or wrists. The partner above should still support enough weight through arms or elbows so the position feels free, not pinned.',
    whyPeopleLikeIt: 'It turns a familiar position into something more emotionally focused. Many people like it because the handhold adds tenderness and makes the closeness feel deliberate.',
    shortSummary: 'A hands-held face-to-face position that adds tenderness, focus, and emotional presence.'
  },

  ip080: {
    focus: 'A wrapped-leg missionary variation that feels close, intimate, and full-bodied. The leg wrap keeps the bodies gathered together while still allowing room for slow adjustment through the hips, arms, and torso.',
    benefits: 'The wrap can help the receiving partner guide closeness and rhythm while keeping the partner above physically tuned in. It adds a sense of being held together without requiring a complex setup.',
    makeItHotter: 'Use the legs as a cue: wrap closer for more pressure, soften for more space, or hold steady during a pause. Small changes in the wrap can create a strong sense of communication.',
    comfort: 'Keep the wrap relaxed enough that neither partner’s hips or lower back feel restricted. If the position starts to feel tense, lower the legs or shift support into pillows and forearms.',
    whyPeopleLikeIt: 'It feels intimate without being complicated. Many couples like it because the leg wrap adds closeness and control while keeping the position familiar and easy to adjust.',
    shortSummary: 'A wrapped-leg face-to-face position that feels close, intimate, and easy to personalize.'
  },

  ip081: {
    focus: 'A slow kiss hold where kissing becomes the center of the position rather than something added on top. The bodies can be lying, seated, or wrapped close together, but the pace stays guided by breath, mouth, and soft contact.',
    benefits: 'This position helps couples slow down and reconnect through a simple, emotionally familiar gesture. It works well when the goal is tenderness, buildup, or returning to each other without rushing into a more intense shape.',
    makeItHotter: 'Let the kiss set the rhythm for the rest of the body. Hands at the face, waist, back, or thighs can add charge while the kiss keeps the pace intimate and grounded.',
    comfort: 'Choose a setup where necks and shoulders can relax. If kissing starts to feel physically awkward, shift into side-lying or seated closeness so the body does not have to strain.',
    whyPeopleLikeIt: 'It feels romantic and unpressured. Many people like it because the position brings attention back to kissing, which can make intimacy feel more personal and less mechanical.',
    shortSummary: 'A slow kissing hold that keeps the moment romantic, grounded, and unhurried.'
  },

  ip082: {
    focus: 'A chest-to-chest recline that lets one partner rest into support while the other settles close. The shape is warm, simple, and body-focused, with enough softness to feel intimate without becoming physically demanding.',
    benefits: 'The reclined support helps both partners stay relaxed while still allowing closeness through the chest, stomach, hips, and arms. It is a good option for gentle intimacy when comfort and contact matter most.',
    makeItHotter: 'Keep one hand steady at the back, waist, or hip and let the rhythm stay small. Bringing the chest closer before adding movement can make the position feel more connected.',
    comfort: 'Support the reclining partner’s back, neck, and knees well. If the partner above or beside them feels like they are sliding or bracing, adjust pillows before continuing.',
    whyPeopleLikeIt: 'It feels warm and easy to settle into. Many couples like it because the recline creates comfort while the chest-to-chest contact keeps the moment intimate.',
    shortSummary: 'A supported chest-to-chest recline for warm, close, low-effort intimacy.'
  },

  ip083: {
    focus: 'A kneeling face-to-face position built around openness, trust, and shared balance. Both partners meet upright on a soft surface, using hands and arms to steady each other while staying close through the hips and chest.',
    benefits: 'The upright kneeling shape can feel vulnerable and direct because both partners are visibly engaged. It allows for strong eye contact, wrapped arms, and a rhythm that feels mutual rather than one-sided.',
    makeItHotter: 'Use the arms as both support and invitation. Pulling closer at the waist or lower back can make the position feel safer and more intense at the same time.',
    comfort: 'Cushion the knees generously and avoid forcing a perfectly upright posture. If balance feels uncertain, move near a headboard, wall, or couch for extra support.',
    whyPeopleLikeIt: 'It feels open and emotionally direct. Many people like it because both partners are upright, active, and visibly present with each other.',
    shortSummary: 'An upright kneeling face-to-face position that feels open, mutual, and trust-centered.'
  },

  ip084: {
    focus: 'A supported eye-contact hold that turns stillness into a form of intimacy. The bodies can be side-lying, seated, or reclined, but the key is choosing a position where both partners can see each other clearly and feel safe being seen.',
    benefits: 'Eye contact can make even a simple hold feel more vulnerable and emotionally resonant. This position helps slow the moment down, creating space for reassurance, desire, tenderness, or quiet repair.',
    makeItHotter: 'Hold eye contact for a few breaths longer than usual, then soften into touch or kissing. A hand at the face, heart, or waist can make the gaze feel grounded rather than exposed.',
    comfort: 'Choose an angle where the neck and face can relax. If direct eye contact feels too intense, try looking away and returning, or let foreheads touch while eyes close.',
    whyPeopleLikeIt: 'It feels intimate because it asks both partners to stay present. Many couples like it because the connection comes from being seen, not from doing more.',
    shortSummary: 'A supported eye-contact hold that makes stillness, presence, and being seen the focus.'
  },

  ip085: {
    focus: 'A stillness-inside-closeness position where both partners pause while already physically connected. The pause can feel vulnerable because nothing is being hidden by motion, but it can also feel deeply reassuring when both bodies stay soft and supported.',
    benefits: 'The stillness gives the nervous system time to catch up with the intimacy. It can help couples notice breath, warmth, emotion, and consent cues that might be missed when everything moves too quickly.',
    makeItHotter: 'Let the pause become part of the build. A hand at the hip, stomach, heart, or face can add intensity without adding movement, and returning slowly afterward can feel more charged.',
    comfort: 'Only pause in a position that can be held easily. If either partner starts bracing, shift the shape, add pillows, or move into side-lying closeness before continuing.',
    whyPeopleLikeIt: 'It feels vulnerable in a meaningful way. Many people like it because the pause creates space for emotional connection and makes the next movement feel more intentional.',
    shortSummary: 'A close stillness hold that uses pause, breath, and presence to deepen the moment.'
  },

  ip086: {
    focus: 'A reunion-style hold for moments when partners want to come back to each other. It begins with a full-body embrace and lets the physical closeness carry a sense of repair, return, or renewed warmth.',
    benefits: 'The position gives emotional meaning to simple contact. It can work after time apart, after a stressful day, or after a tender conversation because the body gets to feel the “we are here again” moment.',
    makeItHotter: 'Hold the embrace longer than usual before adding movement. A slow kiss, hand at the back of the neck, or slight pull at the waist can make the reunion feel more charged.',
    comfort: 'Use a position that lets both partners relax into the hold. If standing feels tiring, move to the couch, bed, or a supported seated position.',
    whyPeopleLikeIt: 'It feels emotionally satisfying and easy to understand. Many couples like it because the position turns a hug into a deliberate act of reconnection.',
    shortSummary: 'A full-body reunion hold for returning to each other with warmth, closeness, and care.'
  },

  ip087: {
    focus: 'A lazy morning cuddle position for intimacy that feels sleepy, affectionate, and unpolished. The bodies stay close under blankets or pillows, with slow touch and small movements that match the softness of waking up together.',
    benefits: 'This position works because it does not ask for performance. It gives couples a way to connect before the day becomes busy, using warmth, closeness, and quiet attention instead of energy or structure.',
    makeItHotter: 'Keep the sleepy mood and add just one deliberate detail: a hand at the waist, a slow kiss, a whispered compliment, or a closer pull through the hips.',
    comfort: 'Keep pillows where they already feel good and avoid over-arranging the moment. If either person is stiff from sleep, shift slowly and let the body wake up before adding more closeness.',
    whyPeopleLikeIt: 'It feels natural and low-pressure. Many people like it because morning closeness can feel intimate without needing to become polished or planned.',
    shortSummary: 'A sleepy morning cuddle position for soft, low-pressure closeness before the day begins.'
  },

  ip088: {
    focus: 'An interlaced-leg position that makes the bodies feel gently woven together. The connection comes from loose contact rather than a tight hold, creating a shape that feels intimate, flexible, and easy to soften.',
    benefits: 'The leg tangle adds a sense of physical linking while still allowing both partners to adjust. It can make side-lying or seated closeness feel more connected without requiring much strength or mobility.',
    makeItHotter: 'Use the leg contact as a subtle cue. Press closer, hook lightly, or release tension as the rhythm changes. Keeping the upper bodies close can make the woven-leg feeling more intimate.',
    comfort: 'Avoid creating a knot that traps either partner’s hips or knees. If anything feels cramped, loosen the legs first, then adjust the upper body.',
    whyPeopleLikeIt: 'It feels connected but not demanding. Many couples like it because the loose leg tangle creates closeness while leaving room to move and breathe.',
    shortSummary: 'A loosely interlaced-leg position that feels woven together, intimate, and flexible.'
  },

  ip089: {
    focus: 'A pillow-supported face-to-face position that helps both partners meet in the middle with more comfort. The pillows create lift, softness, and angle support so the bodies can stay close without unnecessary strain.',
    benefits: 'This position can make classic face-to-face intimacy more accessible by reducing pressure on the hips, back, or shoulders. It also gives partners more control over height and closeness before movement begins.',
    makeItHotter: 'Use the pillow support to hold a slower, more deliberate rhythm. Eye contact, kissing, or a hand at the hip can make the supported shape feel especially intentional.',
    comfort: 'Adjust pillows before building pace. If the angle feels too lifted, remove height; if the lower back feels flat or compressed, add a small cushion under the hips or knees.',
    whyPeopleLikeIt: 'It feels customizable and caring. Many people like it because the pillows make the position easier to sustain while keeping the emotional closeness of face-to-face contact.',
    shortSummary: 'A pillow-supported face-to-face position that makes closeness easier, softer, and more adjustable.'
  },

  ip090: {
    focus: 'A reclined embrace where one partner gets to fully land into support while the other settles close. The position is soft, restorative, and simple enough to feel like a reset rather than a performance.',
    benefits: 'The supported recline helps both partners slow down. It is especially useful when the mood calls for comfort, care, or emotional closeness without a lot of physical demand.',
    makeItHotter: 'Keep one steady point of pressure, like a hand at the waist or chest, while adding a slow kiss or gentle hip shift. The heat comes from being intentional inside the softness.',
    comfort: 'Support the reclined partner’s back, neck, and knees so they can relax completely. If the other partner is leaning over them, make sure their arms or shoulders are also supported.',
    whyPeopleLikeIt: 'It feels calming and affectionate. Many couples like it because the position makes intimacy feel like landing together rather than working toward something.',
    shortSummary: 'A soft reclined embrace that feels restorative, supported, and emotionally close.'
  },

  ip091: {
    focus: 'A partner-on-top hug where the embrace stays at the center of the position. One partner lies back while the other lowers close enough for warmth and contact, supporting their weight so the hug feels secure instead of heavy.',
    benefits: 'The position gives the comfort of a full-body hug with the option for slow movement. It can feel intimate, protective, and grounding because the bodies stay close from chest to hips.',
    makeItHotter: 'Keep the hug intact while adding small rocking or pressure shifts. A hand at the lower back or hips can guide closeness without turning the position into something rushed.',
    comfort: 'The top partner should support enough weight through knees, arms, or forearms. If the lower partner feels compressed, lift the chest slightly or shift into a side-lying hug.',
    whyPeopleLikeIt: 'It feels close and reassuring. Many people like it because the hug makes the physical position feel emotionally warm and easy to trust.',
    shortSummary: 'A partner-on-top hug that keeps warmth, pressure, and emotional closeness at the center.'
  },

  ip092: {
    focus: 'A side cuddle with slow touch that keeps the mood cozy and attentive. Both partners stay mostly relaxed while one partner uses gentle contact along the back, arm, waist, stomach, hip, or thigh to create connection.',
    benefits: 'This position works well when full movement feels like too much but touch still feels wanted. It keeps both partners comfortable while making space for guidance, responsiveness, and quiet sensuality.',
    makeItHotter: 'Let the receiving partner guide the touch with a hand, a word, or a small body shift. Slowing down and repeating the touches that get a response can make the position feel more personal.',
    comfort: 'Use pillows under the head and between the knees. If either partner’s shoulder gets trapped, roll slightly or create more space through the upper body.',
    whyPeopleLikeIt: 'It feels soothing and intimate. Many couples like it because the position lets touch become the main event without asking for much effort.',
    shortSummary: 'A cozy side cuddle focused on slow touch, responsiveness, and low-effort intimacy.'
  },

  ip093: {
    focus: 'A fully wrapped spooning position where the partner behind creates a protective, blanket-like hold. The front partner can soften into the contact while both bodies stay close, warm, and supported.',
    benefits: 'The full wrap can feel emotionally regulating and physically secure. It offers the closeness of a rear position with a much softer, more affectionate energy.',
    makeItHotter: 'Keep the wrap steady and let the intensity come from pressure, breath, and slow hip contact. A hand over the stomach, chest, or thigh can make the hold feel more intentional.',
    comfort: 'Adjust chest contact separately from hip contact. If the front partner feels too enclosed, loosen the upper-body wrap while keeping one grounding point of connection.',
    whyPeopleLikeIt: 'It feels safe and enveloping. Many people like it because the position blends behind-the-body intimacy with a strong sense of comfort.',
    shortSummary: 'A fully wrapped spooning position that feels protective, warm, and deeply held.'
  },

  ip094: {
    focus: 'A sleepy side-lying rhythm that moves like a tide: small, steady, and easy to pause. Both partners stay supported on their sides while the movement remains gentle enough for tired bodies and soft moods.',
    benefits: 'This position is useful when the couple wants closeness without high energy. It can feel sensual and connected while still being restful, making it especially good for late-night or early-morning intimacy.',
    makeItHotter: 'Use long pauses and slow returns instead of increasing speed. A hand at the waist, lower back, or thigh can help guide the tide-like rhythm.',
    comfort: 'Keep the spine, neck, and knees supported. If hips feel cramped, loosen the leg position and focus on upper-body closeness first.',
    whyPeopleLikeIt: 'It feels restful and intimate at the same time. Many couples like it because the rhythm can stay soft without feeling disconnected.',
    shortSummary: 'A sleepy side-lying rhythm with small, tide-like movement and low-effort closeness.'
  },

  ip095: {
    focus: 'A reclined cuddle position that turns warmth and support into the main shape. One partner rests back while the other settles into their side, chest, lap, or arms, creating a calm place for touch and closeness.',
    benefits: 'The position feels easy to enter and easy to personalize. It can be affectionate, sensual, or simply comforting depending on where the bodies settle and how much movement is added.',
    makeItHotter: 'Keep the reclined support in place and add a deliberate touch trail, slow kiss, or closer hip contact. The position works best when the warmth is not rushed.',
    comfort: 'Support the reclining partner’s back and neck, and make sure the other partner is not twisting to stay close. Add pillows before the body starts bracing.',
    whyPeopleLikeIt: 'It feels like comfort with intention. Many people like it because it can stay gentle or become more sensual without needing a dramatic transition.',
    shortSummary: 'A warm reclined cuddle that creates supported closeness and easy, affectionate intimacy.'
  },

  ip096: {
    focus: 'A lazy morning hold for soft, unplanned closeness. The position can be spooning, face-to-face, or resting against each other, but the defining feature is the sleepy pace and the feeling of not needing to perform.',
    benefits: 'This position gives couples a way to connect inside ordinary morning tenderness. It can make intimacy feel woven into real life rather than saved only for planned, high-energy moments.',
    makeItHotter: 'Keep the morning softness and add one intentional cue: a whispered compliment, a hand at the waist, a slow kiss, or a closer pull under the blanket.',
    comfort: 'Let the body stay imperfect and sleepy. Shift pillows, stretch gently, and avoid positions that require strong balance or flexibility before either partner feels awake.',
    whyPeopleLikeIt: 'It feels natural, affectionate, and easy. Many couples like it because it makes closeness feel available without needing a perfect setup.',
    shortSummary: 'A lazy morning hold for sleepy, affectionate, low-pressure intimacy.'
  },

  ip097: {
    focus: 'A side-by-side gentle rock where the motion stays small, steady, and soothing. The bodies lie close while rhythm comes from subtle hip movement, thigh pressure, or a hand guiding the waist.',
    benefits: 'The position is easy on the body while still creating a clear rhythm. It works well for couples who want sensual connection that feels calm, continuous, and comfortable.',
    makeItHotter: 'Let the rhythm build through consistency rather than speed. A long pause, firmer hip contact, or slower return can make the gentle motion feel more intense.',
    comfort: 'Support the head, knees, and lower back with pillows. If side-lying feels cramped, shift the upper body first before changing the hip position.',
    whyPeopleLikeIt: 'It feels calm and rhythmic. Many people like it because the movement is simple enough to relax into but still sensual enough to feel connected.',
    shortSummary: 'A side-by-side gentle rock that feels calm, rhythmic, and easy on the body.'
  },

  ip098: {
    focus: 'A pillow nest position where comfort is designed before closeness begins. The bodies settle into a supported arrangement of pillows, blankets, and angles so the moment can feel soft, secure, and unrushed.',
    benefits: 'Building the nest makes comfort feel intentional instead of accidental. It is especially useful for low-energy nights, sore bodies, or couples who want intimacy to feel cushioned and cared for.',
    makeItHotter: 'Once the nest feels right, add one sensory detail like warm lighting, a softer blanket, slow touch, or a closer hold. The heat comes from making the environment feel chosen.',
    comfort: 'Adjust the pillows before the body starts compensating. Support under knees, hips, shoulders, and lower back can make a major difference.',
    whyPeopleLikeIt: 'It feels luxurious in a quiet way. Many couples like it because the support helps them stay present instead of distracted by discomfort.',
    shortSummary: 'A pillow-supported nest position that makes softness, comfort, and care part of the intimacy.'
  },

  ip099: {
    focus: 'A soft oral-support position that centers attentiveness and comfort. One partner receives while fully supported, and the giving partner finds a low, sustainable angle that allows the moment to stay slow and responsive.',
    benefits: 'The supported setup helps both partners relax into the experience. It gives the receiving partner a sense of being cared for while helping the giving partner avoid unnecessary neck, shoulder, or back strain.',
    makeItHotter: 'Use pauses, eye contact, or grounding touch at the thigh, stomach, or waist. Staying responsive to small cues can make the position feel more intimate than rushing toward intensity.',
    comfort: 'Support the giving partner’s knees, chest, or shoulders and the receiving partner’s hips or lower back. Reset the height if either person feels strained.',
    whyPeopleLikeIt: 'It feels attentive and generous. Many people like it because the position makes giving and receiving feel cared for, not awkward or effortful.',
    shortSummary: 'A soft oral-support position that keeps attention, comfort, and responsiveness at the center.'
  },

  ip100: {
    focus: 'A prone pillow-hug position where one partner rests low into support while the other settles close behind. The pillow creates lift without losing the grounded, hugged-in feeling of the body against the surface.',
    benefits: 'This position can make rear closeness feel softer and more emotionally contained. The support reduces effort for the lower partner while keeping the contact warm and continuous.',
    makeItHotter: 'Keep the upper body low and connected. A hand along the back, waist, or hip can make the position feel more attentive, while small changes in pillow height can sharpen or soften the angle.',
    comfort: 'Avoid over-lifting the hips if the lower back feels compressed. Use enough pillow support for comfort, but keep the chest and breathing relaxed.',
    whyPeopleLikeIt: 'It feels grounded and close. Many couples like it because the pillow support adds comfort while the prone shape keeps the intimacy warm and body-connected.',
    shortSummary: 'A prone pillow-supported position that feels grounded, warm, and softly held from behind.'
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

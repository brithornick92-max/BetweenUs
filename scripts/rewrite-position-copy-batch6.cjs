const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/intimacy-positions.json must have an items array');
}

const patches = {
  ip177: {
    focus: 'A gradual closeness position where both partners move toward intimacy one small yes at a time. The shape can be side-lying, seated, or face-to-face, but the defining feature is the slow build and the ability to pause at every step.',
    benefits: 'This position helps intimacy feel chosen instead of rushed. It gives both partners room to notice comfort, desire, hesitation, and curiosity while staying physically connected.',
    makeItHotter: 'Treat each yes as part of the buildup. A whispered “more,” a closer hold, or a slow return after a pause can make the gradual pace feel deeply charged.',
    comfort: 'Keep the body position simple and supported so both partners can check in easily. If either person needs to slow down, the pause should feel welcomed, not like a problem.',
    whyPeopleLikeIt: 'It feels safe, patient, and intentional. Many couples like it because the slow build makes consent and desire feel connected.',
    shortSummary: 'A gradual closeness position built around slow yeses, pauses, and intentional connection.'
  },

  ip178: {
    focus: 'A body-pressure hold where one partner rests supported weight against the other in a way that feels grounding and contained. The position centers warmth, pressure, and being physically held.',
    benefits: 'Gentle body weight can feel calming, intimate, and emotionally reassuring when it is shared carefully. It creates a strong sense of presence without needing much movement.',
    makeItHotter: 'Use pressure slowly and deliberately. A firmer hold through the chest, hip, or thigh can feel intense when paired with breath, stillness, and clear check-ins.',
    comfort: 'Never place weight where breathing or joints feel restricted. Shift pressure through pillows, arms, knees, or side-lying contact so the hold feels grounding rather than heavy.',
    whyPeopleLikeIt: 'It feels deeply held and regulating. Many people like it because pressure can create closeness without requiring speed or complexity.',
    shortSummary: 'A body-pressure hold that uses warmth, weight, and support to create grounded intimacy.'
  },

  ip179: {
    focus: 'A wall-supported guardrail position where the wall provides steadiness while the bodies stay close. The support gives partners a clear anchor for balance, closeness, and slow movement.',
    benefits: 'The wall makes upright intimacy more secure and easier to adjust. It can feel spontaneous without requiring the strength or balance of a fully unsupported standing position.',
    makeItHotter: 'Use the wall to create a pause, a closer lean, or a slow kiss before adding movement. The support can make stillness feel just as charged as rhythm.',
    comfort: 'Keep feet grounded and knees soft. If pressure against the wall becomes uncomfortable, shift the angle, add a layer of clothing, or move into a seated version.',
    whyPeopleLikeIt: 'It feels spontaneous but stable. Many couples like it because the wall creates enough support to make upright closeness feel confident.',
    shortSummary: 'A wall-supported position for upright closeness, steadiness, and spontaneous energy.'
  },

  ip180: {
    focus: 'A partner-supported lap seat where one partner sits in the other’s lap with the feeling of being cradled rather than balanced alone. The hold is close, warm, and easy to make romantic or more charged.',
    benefits: 'The supported lap shape gives both partners clear roles: one offers a stable base, the other settles in and adjusts closeness. It can feel intimate because the bodies stay face-to-face and wrapped together.',
    makeItHotter: 'Keep the cradled feeling while adding small hip shifts, a slow kiss, or a firmer hold at the waist. Let the support make the position feel safer and more confident.',
    comfort: 'Use a chair, couch, bed, or wall support that keeps the seated partner steady. The partner in the lap should have knees or feet placed so they are not holding all their weight through the hips.',
    whyPeopleLikeIt: 'It feels held and mutual. Many people like it because the lap support makes closeness feel secure without losing heat.',
    shortSummary: 'A cradled lap-seat position for supported face-to-face closeness and warm physical connection.'
  },

  ip181: {
    focus: 'A soft supported stillness position where one partner yields into the support of the other, pillows, or the surface beneath them. The point is not to do more, but to let the body feel safe enough to soften.',
    benefits: 'This position can help partners slow down, regulate, and feel emotionally present. The supported stillness makes intimacy feel caring and receptive rather than effortful.',
    makeItHotter: 'Hold the stillness longer than usual, then add one small touch or closer breath. The restraint of doing less can make the next movement feel more meaningful.',
    comfort: 'Choose a position that can be held without strain. If stillness starts to feel exposing, add a blanket, handhold, or side-by-side angle.',
    whyPeopleLikeIt: 'It feels calm and trustworthy. Many couples like it because the body can release without needing to perform.',
    shortSummary: 'A soft supported stillness position for yielding, breathing, and feeling safely held.'
  },

  ip182: {
    focus: 'A diagonal edge position that uses a rotated body line to create a more exploratory angle. One partner reclines near an edge while the other approaches from a slight diagonal instead of straight on.',
    benefits: 'The diagonal setup can make a familiar edge position feel more precise and novel. It gives partners a way to experiment with angle while keeping the support of the bed or surface.',
    makeItHotter: 'Change the diagonal by small amounts and pause at each new angle. A hand at the thigh, hip, or waist can make the rotated shape feel guided and secure.',
    comfort: 'Avoid twisting the spine or forcing the hips. If the angle feels awkward, return closer to center and use pillows to support the knees or lower back.',
    whyPeopleLikeIt: 'It feels adventurous without being chaotic. Many people like it because small rotations can create a surprisingly different sensation.',
    shortSummary: 'A diagonal edge position that adds exploration through rotation, support, and focused angle.'
  },

  ip183: {
    focus: 'An elevated-hips position that creates a high-tide feeling through lift, openness, and stronger alignment. The receiving partner stays supported while the angle becomes more focused.',
    benefits: 'Hip elevation can create a clearer line of contact while reducing the need for active arching. It lets partners explore intensity through support rather than strain.',
    makeItHotter: 'Start with a moderate lift and slow the rhythm down. A hand at the hips or thighs can make the elevated shape feel more held and deliberate.',
    comfort: 'Use stable pillows or a folded blanket and avoid over-lifting the pelvis. If the lower back feels pinched, reduce the height immediately.',
    whyPeopleLikeIt: 'It feels focused and effective. Many couples like it because the lifted angle changes the experience while keeping the body supported.',
    shortSummary: 'An elevated-hips position for supported lift, openness, and focused intensity.'
  },

  ip184: {
    focus: 'A step-supported standing position that uses a stair, low step, or sturdy platform to change height and angle. The support gives one partner a lifted base while keeping both bodies more stable.',
    benefits: 'The step can make standing closeness more accessible by solving height differences and creating a clearer angle. It adds adventure while still offering structure.',
    makeItHotter: 'Use the step to bring the bodies closer before adding movement. A hand on the wall, rail, waist, or hip can make the position feel more secure and charged.',
    comfort: 'Only use a stable, non-slippery surface. Keep one hand available for balance, and stop if either partner feels unstable.',
    whyPeopleLikeIt: 'It feels playful and practical. Many people like it because the step adds novelty while helping the bodies line up better.',
    shortSummary: 'A step-supported standing position that uses height, balance, and structure for a new angle.'
  },

  ip185: {
    focus: 'A countertop recline where one partner rests on a sturdy surface while the other stands close. The elevated surface creates openness, eye-level closeness, and a bolder change from the usual bedroom setup.',
    benefits: 'The counter height can make the position feel direct and supported at the same time. It gives partners a clear structure for closeness while adding a spontaneous, adventurous mood.',
    makeItHotter: 'Use the surface as the anchor: bring the hips closer, pause with hands at the waist, or let the standing partner guide the angle slowly.',
    comfort: 'Use only a stable surface that can safely support weight. Add a towel or blanket if the edge is hard, and keep the reclining partner’s back or hands supported.',
    whyPeopleLikeIt: 'It feels bold but grounded. Many couples like it because the surface adds adventure while still giving the body support.',
    shortSummary: 'A countertop recline for elevated support, bold closeness, and a more adventurous setup.'
  },

  ip186: {
    focus: 'A standing rear-support position with a skyline-like sense of height and energy. One partner leans into a wall, counter, or sturdy surface while the other stays close behind with grounded support.',
    benefits: 'The supported stance makes upright rear closeness easier to hold. It can feel intense and spontaneous while still allowing both partners to adjust balance, distance, and pressure.',
    makeItHotter: 'Keep the front partner supported before increasing intensity. A hand at the waist, lower back, or hip can make the position feel guided and secure.',
    comfort: 'Make sure both partners have stable footing. If the front partner’s back or legs start to strain, lower the angle by leaning onto a bed, couch, or counter.',
    whyPeopleLikeIt: 'It feels energized and direct. Many people like it because standing support brings heat without requiring a full lift or difficult balance.',
    shortSummary: 'A standing rear-support position with upright energy, grounded balance, and close guidance.'
  },

  ip187: {
    focus: 'A sideways straddle that shifts the lap position into a new angle. One partner sits or reclines while the other straddles from the side, creating a playful frame shift with a different view and line of contact.',
    benefits: 'The side angle changes how the bodies meet while keeping the support of a seated or reclined base. It can feel novel without requiring a high-effort transition.',
    makeItHotter: 'Use the side angle slowly. Let the top partner adjust hips, knees, and hands until the position feels confident, then add small movement or a close hold.',
    comfort: 'Support the top partner’s knees and use hands for balance. If the side angle feels twisted, rotate closer to face-to-face or add pillows under the hips.',
    whyPeopleLikeIt: 'It feels fresh and playful. Many couples like it because the sideways approach changes the mood of a familiar straddle.',
    shortSummary: 'A sideways straddle that shifts the frame, angle, and energy of lap-based closeness.'
  },

  ip188: {
    focus: 'A cross-leg angle that uses overlapping legs to create a new line of contact. The shape feels exploratory and close, with partners adjusting the cross until the hips and bodies meet comfortably.',
    benefits: 'The crossed angle can create a different sensation without needing a dramatic position. It allows small changes in leg placement to shape pressure, openness, and closeness.',
    makeItHotter: 'Move slowly through the setup and treat each leg adjustment as part of the build. A hand at the thigh or hip can help guide the angle.',
    comfort: 'Do not force knees, hips, or ankles into a tight cross. If the legs feel crowded, loosen the shape and keep only one point of leg contact.',
    whyPeopleLikeIt: 'It feels unique and adjustable. Many people like it because leg placement can shift the entire experience in subtle ways.',
    shortSummary: 'A cross-leg angle position for exploratory closeness, subtle pressure, and adjustable contact.'
  },

  ip189: {
    focus: 'A rotated missionary variation that keeps the familiar face-to-face base but pivots the hips or torso slightly. The rotation creates a new angle while preserving closeness and eye contact.',
    benefits: 'The pivot makes a classic shape feel refreshed without requiring a complicated setup. It gives partners a simple way to explore precision, pressure, and body alignment.',
    makeItHotter: 'Rotate just a little at first. A pillow under one hip or a hand guiding the waist can help hold the angle while the rhythm stays slow.',
    comfort: 'Keep shoulders, knees, and lower back relaxed. If the rotation causes twisting, reduce the angle and rebuild from a more centered position.',
    whyPeopleLikeIt: 'It feels familiar and new at the same time. Many couples like it because the rotation changes sensation without losing emotional closeness.',
    shortSummary: 'A rotated missionary variation that adds a fresh angle while staying close and familiar.'
  },

  ip190: {
    focus: 'A bed-edge lift that uses the edge of the bed to support one partner while creating a lifted, open angle. The surface carries part of the setup so the bodies can focus on closeness and alignment.',
    benefits: 'The bed edge makes the position easier to structure and adjust. It can feel more intense than lying flat while still being more supported than a standing or lifted variation.',
    makeItHotter: 'Adjust the distance from the edge slowly. A closer hip line, supported thighs, or a steady pause can make the lifted angle feel more deliberate.',
    comfort: 'Pad the bed edge if needed and keep the reclining partner’s lower back supported. If the edge height does not work, switch to kneeling or standing based on comfort.',
    whyPeopleLikeIt: 'It feels focused and supported. Many people like it because the bed edge creates a strong angle without making the position feel unstable.',
    shortSummary: 'A bed-edge lift that offers a supported, open angle with steady structure.'
  },

  ip191: {
    focus: 'A supported standing lift for couples who want a more adventurous, high-energy option with clear support. One partner is partially lifted or held while both use a wall, surface, or strong stance for stability.',
    benefits: 'The lift can feel exciting and bold when it is done with care and realistic support. It creates a sense of drama without needing the entire position to rely on strength alone.',
    makeItHotter: 'Keep the lift brief, close, and well-supported. A wall, counter, or bed edge can make the position feel more secure while preserving the thrill.',
    comfort: 'Only try this if both partners feel physically capable and stable. Avoid slippery surfaces, protect the lower back, and switch quickly if strength or balance becomes a concern.',
    whyPeopleLikeIt: 'It feels adventurous and cinematic. Many couples like it because the lifted element adds excitement when the support is handled safely.',
    shortSummary: 'A supported standing lift for adventurous energy, strong closeness, and careful stability.'
  },

  ip192: {
    focus: 'A one-leg-hooked position where one partner hooks a leg around the other to create a crescent-shaped angle. The hook adds closeness and direction while keeping the rest of the body supported.',
    benefits: 'The single-leg hook can make the position feel more connected and focused without requiring both legs to lift or wrap. It gives partners a simple way to adjust angle and pressure.',
    makeItHotter: 'Use the hooked leg as a cue for closeness. Tighten the hook slightly to invite more contact, soften it for more space, or pause while staying held together.',
    comfort: 'Keep the hooked leg relaxed and avoid pulling through the knee. If the hip starts to tire, lower the leg or support it with a hand or pillow.',
    whyPeopleLikeIt: 'It feels close and responsive. Many people like it because the leg hook gives the body a natural way to guide connection.',
    shortSummary: 'A one-leg-hooked position that creates a crescent angle, closeness, and adjustable pressure.'
  },

  ip193: {
    focus: 'An alternating front-and-side position where partners shift between two angles instead of staying in one shape. The switchback creates variety while keeping the movement slow and intentional.',
    benefits: 'Moving between front and side contact can help partners discover which angle feels best in the moment. It adds novelty without requiring a full reset or a new setup.',
    makeItHotter: 'Choose two angles and alternate slowly. Pause after each switch to let the body register the change before deciding whether to stay or move again.',
    comfort: 'Use pillows and hands for support during transitions. If switching feels awkward, make the angle change smaller or settle into the easier side.',
    whyPeopleLikeIt: 'It feels exploratory and responsive. Many couples like it because the position allows variety without losing connection.',
    shortSummary: 'An alternating front-and-side position for slow transitions, exploration, and responsive angle changes.'
  },

  ip194: {
    focus: 'A bent-over surface position where one partner leans into a sturdy support while the other stays close behind. The surface gives stability, making the position feel direct, grounded, and easier to adjust.',
    benefits: 'The supported surface helps reduce strain through the front partner’s back, legs, and arms. It creates a strong angle while keeping the body from having to hold everything alone.',
    makeItHotter: 'Bring the bodies closer before increasing pace. A hand at the waist, lower back, or thigh can make the position feel more guided and connected.',
    comfort: 'Choose a surface at the right height and pad hard edges if needed. If the front partner feels too folded, raise the torso or bend the knees more.',
    whyPeopleLikeIt: 'It feels direct and stable. Many people like it because the surface support makes the position easier to hold while keeping the intensity.',
    shortSummary: 'A bent-over surface position with grounded support, direct angle, and easy adjustment.'
  },

  ip195: {
    focus: 'A kneeling upright position that creates height, closeness, and a more active shared posture. Both partners use knees, thighs, hands, or a nearby support to stay balanced while the bodies meet upright.',
    benefits: 'The upright kneeling shape can feel engaged and intimate because both partners are physically involved. It offers more height and energy than lying down while still feeling connected and close.',
    makeItHotter: 'Use the hands to guide the waist or lower back and keep the hips close. A slow pause in the upright hold can make the position feel stronger before movement continues.',
    comfort: 'Cushion the knees well and avoid staying upright if the lower back starts to tire. Use a wall, bed, or headboard for extra support.',
    whyPeopleLikeIt: 'It feels active and connected. Many couples like it because the upright posture creates intensity while still allowing a close hold.',
    shortSummary: 'A kneeling upright position for active closeness, height, and strong shared support.'
  },

  ip196: {
    focus: 'A supported wide-leg recline that creates openness with careful structure. One partner reclines while the legs are supported by pillows, hands, or the surface so the open shape feels stable rather than forced.',
    benefits: 'This position can create a strong sense of exposure and intensity while keeping the body cared for. It works best when openness is paired with steady support and clear communication.',
    makeItHotter: 'Use slow touch at the thighs, hips, or waist to make the openness feel attended to. Pausing before movement can make the position feel more charged and trust-centered.',
    comfort: 'Support the knees and hips, and never push the legs wider than feels natural. Add pillows or lower the legs if the inner thighs or lower back feel strained.',
    whyPeopleLikeIt: 'It feels open and supported. Many people like it because the position combines intensity with visible care.',
    shortSummary: 'A supported wide-leg recline for open angle, careful support, and trust-centered intensity.'
  },

  ip197: {
    focus: 'A seated side-straddle where one partner sits while the other settles sideways across their lap or thigh. The sideways placement creates a different angle and a more relaxed, conversational kind of closeness.',
    benefits: 'The side straddle can feel playful and intimate without requiring a full face-to-face lap position. It gives both partners room for touch, kissing, guidance, and slow adjustment.',
    makeItHotter: 'Use the sideways angle for teasing pauses, close holds, or slow hip shifts. A hand at the waist or thigh can make the position feel secure and guided.',
    comfort: 'Support the seated partner’s back and the straddling partner’s knees or feet. If the side angle feels unbalanced, rotate slightly closer to face-to-face.',
    whyPeopleLikeIt: 'It feels casual and close. Many couples like it because the side angle makes lap closeness feel fresh and easy to personalize.',
    shortSummary: 'A seated side-straddle position for relaxed lap closeness, fresh angle, and playful contact.'
  },

  ip198: {
    focus: 'A side-entry position where partners meet from an angle rather than directly front or back. The shape feels exploratory, with the bodies adjusting through hips, thighs, and torso until the line of contact feels right.',
    benefits: 'Side entry can make intimacy feel more nuanced and body-aware. It gives couples a way to explore different pressure and closeness while staying supported by the bed or surface.',
    makeItHotter: 'Move slowly into the side angle and pause once the bodies line up. A hand at the hip, leg, or lower back can help hold the position while keeping it responsive.',
    comfort: 'Use pillows under knees, hips, or the waist if the angle feels uneven. If either partner feels twisted, reduce the rotation and bring the bodies closer to a neutral line.',
    whyPeopleLikeIt: 'It feels exploratory and adjustable. Many people like it because the side angle creates new sensation without needing high effort.',
    shortSummary: 'A side-entry position that uses angled closeness, support, and small adjustments.'
  },

  ip199: {
    focus: 'A choose-your-angle position where partners intentionally experiment with the setup that feels best in the moment. Instead of prescribing one shape, the position invites curiosity, adjustment, and shared decision-making.',
    benefits: 'This position gives couples permission to personalize. It is especially useful when bodies, moods, or energy levels change and the best option is something discovered together.',
    makeItHotter: 'Choose three angles to test and give each one a short try. Rate them with simple words like softer, deeper, closer, easier, or more connected.',
    comfort: 'Keep experimentation slow and supported. If an angle feels off, treat that as useful information rather than something to push through.',
    whyPeopleLikeIt: 'It feels flexible and collaborative. Many couples like it because the position adapts to the people instead of forcing the people into the position.',
    shortSummary: 'A choose-your-angle position for flexible exploration, shared feedback, and personalized closeness.'
  },

  ip200: {
    focus: 'A high-surface recline that uses a taller bed, counter, or sturdy surface to create a lifted, rooftop-like angle. The elevated setup feels bold and spacious while still giving one partner physical support.',
    benefits: 'The height can change the whole mood of the position, making it feel more adventurous and cinematic. It also helps partners adjust alignment without relying only on strength or flexibility.',
    makeItHotter: 'Use the height to create anticipation before movement begins. A slow approach, hands at the thighs, or a pause at the edge can make the setup feel more charged.',
    comfort: 'Only use a stable surface that safely supports weight. Add padding under the reclining partner and make sure the standing partner has steady footing.',
    whyPeopleLikeIt: 'It feels bold and elevated. Many couples like it because the higher surface creates a different angle and a more adventurous atmosphere.',
    shortSummary: 'A high-surface recline for elevated angle, bold energy, and sturdy support.'
  },

  ip201: {
    focus: 'A favorite-finish hold that lets couples end with the position, cuddle, or closeness style that feels most like them. It is less about novelty and more about choosing the ending that makes both partners feel connected.',
    benefits: 'Ending intentionally can make the whole experience feel more complete. This position gives partners a chance to return to what works, feel cared for, and close the moment with warmth.',
    makeItHotter: 'Choose the finish together: a favorite hold, a slow kiss, a final cuddle, or a quiet pause. The intimacy comes from making the ending feel chosen instead of automatic.',
    comfort: 'Pick something both bodies can relax into. If either partner feels tired or overstimulated, choose a softer hold with space to breathe.',
    whyPeopleLikeIt: 'It feels personal and emotionally satisfying. Many couples like it because the best ending is often the one that feels most like their relationship.',
    shortSummary: 'A favorite-finish hold for closing intimacy with warmth, choice, and connection.'
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

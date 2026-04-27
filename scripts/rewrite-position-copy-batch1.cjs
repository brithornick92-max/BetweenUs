const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/intimacy-positions.json must have an items array');
}

const patches = {
  ip101: {
    focus: 'A softened missionary variation that uses hip support to make the angle feel easier, steadier, and more emotionally present. The pillow lift keeps the receiving partner supported instead of strained, while the partner above can stay close enough for kissing, eye contact, and slow pressure. It is a good position for intimacy that feels warm, grounded, and unhurried.',
    benefits: 'The extra lift can make classic face-to-face closeness feel more comfortable and more precise without asking either body to work hard. It supports a slower rhythm, gives both partners room to adjust pressure, and keeps the mood tender rather than overly effortful.',
    makeItHotter: 'Stay low and close before adding intensity. A hand at the cheek, waist, or hip can make the supported angle feel more intentional, and pausing for a few breaths can make the pressure feel deeper without speeding up.',
    comfort: 'Start with a low pillow and increase height only if the lower back still feels relaxed. If the angle feels too sharp, flatten the support or place a second cushion under the knees. The receiving partner should feel lifted, not arched.',
    shortSummary: 'A pillow-supported face-to-face position that makes classic closeness feel softer, steadier, and easier to stay in.'
  },

  ip052: {
    focus: 'A close-aligned position built around pressure, rhythm, and staying connected through the whole front of the body. Instead of pulling away to create motion, both partners stay chest-to-chest while the movement comes from subtle rocking and gliding. It feels slow, sensual, and highly tuned to small adjustments.',
    benefits: 'This position often makes a little movement feel like a lot because the bodies stay continuously connected. It can be especially good for partners who want intensity without a fast pace, and for couples who enjoy feeling rhythm through breath, pressure, and closeness.',
    makeItHotter: 'Keep the pelvises connected and experiment with slow rocking instead of thrusting. A slight change in hip height, leg wrap, or torso pressure can make the sensation more focused while keeping the mood intimate.',
    comfort: 'Use forearms, elbows, or pillows so the partner above is not resting too much weight on the partner below. If the lower back or hips feel compressed, shift the receiving partner’s pelvis slightly or add support under the hips.',
    shortSummary: 'A chest-to-chest alignment position where slow rocking and steady pressure create the intensity.'
  },

  ip053: {
    focus: 'An edge-supported recline that opens the body through the hips while keeping the setup stable and easy to adjust. The partner near the edge stays supported by the surface, while the partner in front can settle into the best distance and angle. It feels open, focused, and a little more charged than a fully reclined position.',
    benefits: 'The edge gives both partners a clear structure: one body is supported, the other can guide pace and angle. It can create a stronger sensation without requiring athletic effort, and it gives plenty of room for hands at the thighs, hips, waist, or surface.',
    makeItHotter: 'Adjust distance from the edge before changing pace. Pulling the hips slightly closer can make the position feel more direct, while holding the thighs or waist can create a stronger sense of being guided and held.',
    comfort: 'Make sure the edge is padded enough and the surface height works for both bodies. If the reclining partner feels pulled too far open, bend the knees more or let the legs rest lower. Stability matters more than dramatic shape.',
    shortSummary: 'A supported edge-of-bed recline with an open angle and steady, easy-to-adjust intensity.'
  },

  ip054: {
    focus: 'A chair-based face-to-face position that feels intimate, contained, and grounded. The seated partner has a stable base, while the partner in their lap can settle into closeness without needing a large range of motion. It works well for eye contact, wrapped arms, and a rhythm that begins as a hug.',
    benefits: 'The chair creates structure and support, making this feel more secure than an unsupported lap position. It keeps both partners upright and close, which can make the connection feel personal, attentive, and emotionally present.',
    makeItHotter: 'Use the back of the chair for steadiness and let the partner on top control small rocking or circling movements. Staying chest-to-chest can make the position feel more intimate, while a slightly more upright posture can make it feel bolder.',
    comfort: 'Choose a sturdy chair with enough seat depth for balance. Add a cushion if the seat is hard, and keep feet or knees supported so the top partner does not have to hold tension the whole time.',
    shortSummary: 'A sturdy chair lap position that keeps both partners upright, close, and emotionally connected.'
  },

  ip055: {
    focus: 'A lazy spooning variation for soft, low-effort intimacy when the mood is cozy rather than performative. Both partners stay nested on their sides, with the movement coming from small shifts and steady pressure instead of big motion. It feels sleepy, warm, and easy to return to.',
    benefits: 'Because both bodies are supported by the bed or couch, this can be one of the easiest positions to stay in. It keeps closeness continuous, gives the partner in front a held feeling, and lets the partner behind stay connected without needing a lot of strength or leverage.',
    makeItHotter: 'Keep the bodies close through the hips while letting the upper body stay relaxed. A hand at the waist, stomach, chest, or thigh can make the position feel more attentive without changing the calm energy.',
    comfort: 'Use a pillow between the knees to reduce hip strain. If the front partner feels crowded, create a little space at the chest while keeping the hips close. The hold should feel wrapped, not trapped.',
    shortSummary: 'A relaxed spooning position for cozy, low-effort closeness and slow side-lying rhythm.'
  },

  ip056: {
    focus: 'A side-lying face-to-face position where one leg drapes over the other partner to create a gentle opening. The bodies stay close and relaxed, but the leg wrap gives the position a more connected, woven-together feeling. It is intimate without needing a lot of movement.',
    benefits: 'The leg-over-hip shape can make side-lying closeness feel more anchored and adjustable. It allows both partners to stay soft through the upper body while changing sensation through small shifts in the lifted leg, hips, and torso.',
    makeItHotter: 'Try moving the top leg slightly higher or lower and notice how much the angle changes. Keeping the upper bodies close, adding slow kissing, or resting a hand at the lower back can make it feel more emotionally charged.',
    comfort: 'Support the top leg with a hand, pillow, or relaxed bend if the hip starts to tire. If either partner feels twisted, loosen the leg wrap and rebuild the position from the upper-body closeness first.',
    shortSummary: 'A side-lying leg-wrap position that feels woven together, intimate, and easy to adjust.'
  },

  ip057: {
    focus: 'A wrapped-leg face-to-face position that turns classic closeness into something more gathered and warm. The leg wrap invites the bodies closer without needing a complicated shape, creating a feeling of being held in place by choice rather than force.',
    benefits: 'The wrapped legs help guide closeness, pressure, and rhythm while keeping both partners visually and physically connected. It can make a familiar position feel more personal, especially when the movement stays slow enough for touch and eye contact.',
    makeItHotter: 'Use the leg wrap to invite closeness rather than to pull hard. Tighten the wrap for a more held feeling, soften it for more space, and let the partner above respond to those cues instead of changing pace first.',
    comfort: 'Keep the legs loose enough that the hips and lower back can relax. If the partner above feels restricted, lower the wrap slightly or shift weight into forearms so both bodies can breathe and adjust.',
    shortSummary: 'A legs-wrapped face-to-face position that feels warm, close, and securely gathered together.'
  },

  ip058: {
    focus: 'A standing wall-supported position with a strong, passionate energy and built-in stability. The wall gives one partner something to lean into, while the other can stay grounded and close. It feels immediate, charged, and more secure than a fully unsupported standing position.',
    benefits: 'The wall reduces balance demands and lets both partners focus on closeness, pressure, and rhythm. It can feel spontaneous without becoming unstable, and the upright posture gives the whole position a bold, direct quality.',
    makeItHotter: 'Use the wall as part of the connection: press closer, pause with the bodies held still, or let one partner guide the other’s hips gently. A lifted leg can add intensity, but only if balance still feels easy.',
    comfort: 'Keep both feet grounded at first and add a lifted leg only after the stance feels secure. If the wall feels hard against the back or shoulders, add clothing, a towel, or shift the angle so pressure stays comfortable.',
    shortSummary: 'A passionate wall-supported standing position that feels bold, close, and steadier than a full lift.'
  },

  ip059: {
    focus: 'A bed-supported rear-entry position where the front partner can lean forward and let the surface carry most of the weight. The bed creates steadiness, while the partner behind can stay close at the hips and guide the angle. It feels grounded, direct, and easy to personalize.',
    benefits: 'Because the torso is supported, this can be more sustainable than standing or hands-and-knees variations. The bed height helps set the angle, and both partners can adjust stance, knee bend, and hip distance until the position feels natural.',
    makeItHotter: 'Bring the bodies closer before increasing speed. A hand at the waist, lower back, thigh, or shoulder can make the position feel more guided, while a slower pace can make the supported angle feel more intense.',
    comfort: 'Match the surface height to the bodies as much as possible. If the bed is too low, bend the knees or use a pillow under the torso. If the front partner’s lower back feels strained, bring the chest lower and soften the stance.',
    shortSummary: 'A bed-supported rear-entry position with a grounded angle and plenty of room for adjustment.'
  },

  ip060: {
    focus: 'A pillow-supported prone position that keeps the body low, close, and grounded. The receiving partner can rest into the surface while the pillow creates just enough lift through the hips or torso. It feels warm, contained, and less physically demanding than more upright rear-entry positions.',
    benefits: 'The pillow support makes the angle easier to hold and can reduce the need for active bracing. It keeps the energy slow and body-close while still offering a clear shape for pressure, closeness, and rhythm.',
    makeItHotter: 'Stay low through the torso and let the pillow do the angle work. A hand along the back, waist, or thigh can make the position feel more intimate, and tiny changes in pillow height can shift the sensation a lot.',
    comfort: 'Avoid stacking pillows too high at first. The lower partner should feel lifted, not folded or compressed. If breathing, hips, or lower back feel restricted, lower the support and create more space through the chest.',
    shortSummary: 'A low, pillow-supported prone position that feels grounded, warm, and easy to settle into.'
  },

  ip061: {
    focus: 'A seated receiving position that makes oral intimacy feel supported, playful, and easy to communicate through. One partner stays upright and grounded while the other settles low enough to stay comfortable. The shape feels direct without needing either person to hold an awkward posture.',
    benefits: 'The seated setup gives the receiving partner a sense of presence and control while helping the giving partner find a workable height. It is easy to pause, adjust, laugh, guide, or soften the energy without breaking the moment.',
    makeItHotter: 'Use the seated partner’s hands, words, or eye contact to guide pace and closeness. A slower start can make the position feel more attentive, while a firmer hand at the shoulder, hair, or thigh can add charge if both partners like that dynamic.',
    comfort: 'Use pillows under the kneeling partner’s knees or choose a couch/bed edge with better height. Neck and shoulder comfort matter here, so adjust the setup before trying to continue through strain.',
    shortSummary: 'A supported seated oral position that feels playful, direct, and easy to communicate through.'
  },

  ip062: {
    focus: 'A reclined receiving position that centers openness, attention, and trust. The supported partner can fully settle back while the giving partner stays close and responsive. It feels vulnerable in a soft way because the body is open, but the mood is still calm and cared for.',
    benefits: 'This position gives the receiving partner room to relax instead of bracing, while the giving partner can use hands, pillows, and small adjustments to keep everything comfortable. It works well when the goal is attentiveness rather than speed.',
    makeItHotter: 'Use slow pauses, eye contact, or a hand at the stomach, thigh, or waist to keep the receiving partner grounded. The position can feel more intense when the giving partner takes their time and checks in through touch rather than rushing.',
    comfort: 'Support the reclining partner’s head, back, hips, or knees so they do not have to hold themselves open. The giving partner should also support their own knees, chest, or shoulders as needed.',
    shortSummary: 'A reclined receiving position that feels open, attentive, and safely supported.'
  },

  ip063: {
    focus: 'A standing one-leg-raised position that adds adventure without requiring a full lift. One partner stays grounded while the other opens through one lifted leg, using a wall or surface for steadiness. It feels bold, close, and energetic when the balance is right.',
    benefits: 'The lifted leg changes the angle while keeping the position more accessible than a standing carry. It gives the standing partner a clear place to support, and the nearby wall or surface can make the whole setup feel more secure.',
    makeItHotter: 'Start with the lifted leg lower than expected, then raise or wrap it only if balance feels easy. Pulling the bodies closer at the waist or hips can make the position feel more stable and more charged at the same time.',
    comfort: 'Use a wall, counter, bed edge, or sturdy furniture for balance. If the lifted hip, knee, or ankle feels strained, lower the leg immediately. This position should feel adventurous, not precarious.',
    shortSummary: 'A standing one-leg-raised position with a bold angle and built-in balance support.'
  },

  ip064: {
    focus: 'A close face-to-face position where the wrapped legs create a halo of contact around the partner above. The shape feels intimate and full-bodied, with the leg wrap guiding closeness while the upper bodies stay connected through touch, kissing, or eye contact.',
    benefits: 'The wrap makes a familiar face-to-face setup feel more secure and emotionally gathered. It helps both partners communicate closeness through the body itself: tighter for more pressure, softer for more space, slower for more presence.',
    makeItHotter: 'Let the leg wrap become part of the rhythm. The reclining partner can use the legs to invite closer contact, while the partner above responds with smaller, slower movement instead of simply speeding up.',
    comfort: 'Keep the wrap loose enough to avoid hip or lower-back tension. If the top partner feels restricted, shift support into the arms or let the wrapped legs rest lower around the hips instead of the waist.',
    shortSummary: 'A legs-around-waist face-to-face position that feels intimate, full-bodied, and securely close.'
  },

  ip065: {
    focus: 'A sideways edge position that changes the usual angle by bringing one partner in from the side instead of straight on. The diagonal setup feels curious and exploratory, with small changes in hip placement creating noticeably different sensations.',
    benefits: 'The sideways approach offers novelty without needing a highly athletic shape. It can be easier to adjust than it looks, especially when the reclining partner uses pillows and the partner at the edge supports the thigh or hip.',
    makeItHotter: 'Move slowly and treat the angle like the main feature. A hand at the lifted leg, waist, or hip can help guide the shape, while slight rotation through the torso can make the position feel more focused.',
    comfort: 'Use pillows under the hips or knees if the diagonal angle feels uneven. If either partner feels twisted, return to a more neutral alignment and rebuild the position with less rotation.',
    shortSummary: 'A sideways edge-of-bed position with a curious diagonal angle and lots of small adjustments.'
  },

  ip066: {
    focus: 'A stillness-based position for couples who want closeness without performance. Any comfortable hold can become The Hush once the movement pauses and both partners bring attention to breath, warmth, and contact. It feels tender, grounding, and emotionally quiet.',
    benefits: 'The pause helps the body settle and gives both partners time to feel connected without chasing intensity. It can turn an ordinary position into something more intimate because the focus shifts from what to do next to what is already happening between you.',
    makeItHotter: 'Let the stillness last longer than feels automatic. A hand over the heart, at the waist, or along the face can make the pause feel intentional, and beginning again with tiny movements can make the return feel more charged.',
    comfort: 'Choose a position that can be held without effort before adding the stillness. Support knees, hips, shoulders, or backs so neither partner has to tense just to stay close.',
    shortSummary: 'A stillness-based intimacy hold that turns closeness, breath, and pause into the center of the moment.'
  },

  ip067: {
    focus: 'A kneeling face-to-face position that feels passionate, open, and a little ceremonial. Both partners meet upright on a soft surface, using arms around the body for balance and closeness. It can feel intense because the bodies are vertical, exposed, and fully engaged.',
    benefits: 'The kneeling shape brings both partners to the same level, which can make the position feel mutual and emotionally direct. It allows for hugging, kissing, eye contact, and strong hip closeness while still keeping the rhythm controlled.',
    makeItHotter: 'Use the embrace as support, not just affection. Pulling closer through the hips can make the position feel more secure, while a slower rhythm or held pause can make the upright closeness feel more intense.',
    comfort: 'Cushion the knees well and avoid staying fully upright if the lower back starts to tire. One partner can sit back slightly on the heels, or both can shift closer to a wall or headboard for extra support.',
    shortSummary: 'A kneeling face-to-face position with passionate upright closeness and a strong mutual hold.'
  },

  ip068: {
    focus: 'A one-leg-raised face-to-face position that creates a sharper angle while keeping the bodies close. The lifted leg rests along a shoulder or upper arm, giving the shape a ribbon-like openness without requiring both legs to be raised.',
    benefits: 'Because only one leg is lifted, this can feel more accessible than a full legs-up variation while still offering a focused angle. It gives the partner above a clear place to support and lets the reclining partner adjust intensity by raising or lowering the leg.',
    makeItHotter: 'Support the lifted leg with care and move slowly before increasing depth or pace. A slight turn of the hips or a small change in leg height can make the position feel completely different.',
    comfort: 'Do not force the leg higher than it naturally wants to go. If the hamstring, hip, or lower back feels strained, bend the knee more or rest the leg on the upper arm instead of the shoulder.',
    shortSummary: 'A one-leg-over-shoulder position that creates a focused angle while staying close and adjustable.'
  },

  ip069: {
    focus: 'A riding variation built around circles, figure-eights, and soft hip patterns rather than a straight up-and-down rhythm. The partner on top gets room to explore what feels good through shape and pressure, making the position confident, playful, and self-directed.',
    benefits: 'The circular motion can make the sensation feel more nuanced and customizable. It gives the top partner more control over angle and pressure while keeping the lower partner involved through touch, support, and feedback.',
    makeItHotter: 'Keep the circles small at first and let the hips find the best path. Hands on the chest, thighs, bed, or waist can help with balance, and changing the direction of the circle can shift the feeling quickly.',
    comfort: 'The top partner should use hand support before the legs get tired. If knees or thighs start working too hard, switch to slower grinding, lean forward, or pause with the bodies close.',
    shortSummary: 'A circular riding position where small hip patterns create playful control and responsive sensation.'
  },

  ip070: {
    focus: 'A post-intimacy hold that makes the after-moment part of the connection instead of an afterthought. Both partners stay close, letting the nervous system settle through warmth, pressure, and touch. It feels soft, grateful, and emotionally gathering.',
    benefits: 'Remaining close after intensity can help both partners feel cared for and connected. This position supports emotional landing, reassurance, and quiet appreciation, especially after a more vulnerable or heated experience.',
    makeItHotter: 'Keep one point of contact intentional: a hand on the heart, fingers interlaced, a forehead touch, or a slow kiss. The heat here comes from staying present after the peak instead of immediately moving away.',
    comfort: 'Choose a hold that lets both partners breathe and relax. If anyone feels overheated, crowded, or overstimulated, loosen the position while keeping a hand, leg, or shoulder connected.',
    shortSummary: 'A post-intimacy holding position that helps both partners land, reconnect, and feel cared for.'
  },

  ip071: {
    focus: 'A chest-to-chest stillness hold that feels devoted, quiet, and emotionally close. Both partners stay pressed together enough to feel breath and heartbeat, letting the position become more about presence than motion.',
    benefits: 'The full-front contact can create a strong sense of reassurance and belonging. It works well when couples want intimacy that feels meaningful, slow, and emotionally sincere rather than energetic.',
    makeItHotter: 'Hold the stillness for a few breaths before moving. A hand over the heart, along the back, or at the jaw can make the closeness feel more deliberate, and tiny synchronized movements can build intensity without breaking the softness.',
    comfort: 'Make sure neither partner is taking too much weight through the chest or shoulders. Use pillows, side-lying, or a seated variation if full chest-to-chest pressure feels too heavy.',
    shortSummary: 'A devoted chest-to-chest hold built around stillness, breath, and emotional closeness.'
  },

  ip072: {
    focus: 'A forehead-to-forehead position that turns a simple hold into a tender point of contact. The closeness is quiet and vulnerable, with both partners close enough to breathe together, check in, or simply pause before the moment becomes more physical.',
    benefits: 'The forehead contact can make the position feel emotionally safe and intentional. It naturally slows the pace, invites eye contact or closed-eye closeness, and helps both partners stay tuned in instead of rushing ahead.',
    makeItHotter: 'Let the forehead touch become an anchor while hands explore slowly at the face, waist, back, or thighs. The contrast between stillness at the face and subtle movement elsewhere can feel especially intimate.',
    comfort: 'Choose a position where necks can stay relaxed. If forehead contact feels awkward, shift slightly so temples, cheeks, or noses touch instead. The emotional cue matters more than perfect alignment.',
    shortSummary: 'A forehead-to-forehead hold that creates tender closeness, safety, and a slower emotional pace.'
  },

  ip073: {
    focus: 'A reclined lap position that feels warm, intimate, and supported from underneath. One partner rests back into pillows while the other settles into their lap, creating a softer version of face-to-face seated closeness.',
    benefits: 'The reclined support helps the holding partner stay relaxed while still offering a secure base. It can feel less physically demanding than a fully upright lap position, while still keeping the bodies close through the chest, hips, and arms.',
    makeItHotter: 'Use the recline to slow everything down. Wrapped arms, close chest contact, and small rocking motions can make the position feel deeply connected without needing much force or range.',
    comfort: 'Support the reclining partner’s back and shoulders well. The partner in the lap should have knees or feet grounded enough to avoid balancing entirely through the hips.',
    shortSummary: 'A reclined lap hold that offers face-to-face closeness with extra back support and warmth.'
  },

  ip074: {
    focus: 'A soft missionary variation for romantic, unhurried closeness. The bodies stay near enough for kissing and touch, but the pressure remains gentle and adjustable. It is familiar in shape but intentionally slowed down.',
    benefits: 'The simplicity makes this position easy to settle into, especially when the goal is tenderness rather than novelty. It allows for eye contact, wrapped legs, handholding, or gentle touch without requiring a complex setup.',
    makeItHotter: 'Use the familiarity as a strength: slow the pace, hold eye contact longer, or pause with the bodies close. A small pillow under the hips can add focus without changing the soft mood.',
    comfort: 'The partner above should support enough weight that the partner below can breathe comfortably. Pillows under the knees, hips, or shoulders can soften pressure and make the position easier to hold.',
    shortSummary: 'A soft face-to-face missionary variation for romantic closeness, kissing, and gentle rhythm.'
  },

  ip075: {
    focus: 'A full-body embrace position centered on safety, warmth, and being gathered in. It can happen in spooning, side-lying, or supported face-to-face closeness, as long as both partners feel held without strain.',
    benefits: 'The emphasis on full-body contact can help the position feel emotionally regulating and deeply reassuring. It is especially useful when the desired mood is comfort, care, and closeness rather than novelty or intensity.',
    makeItHotter: 'Let pressure become the language. A firmer hug, slower breath, hand at the back of the neck, or gentle rocking can make the embrace feel more intimate while still staying soft.',
    comfort: 'Support any places that are holding weight: knees, hips, shoulders, or lower back. If the hold starts to feel too tight, loosen the arms while keeping one grounding point of contact.',
    shortSummary: 'A full-body embrace that feels safe, warm, and deeply held without needing much movement.'
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

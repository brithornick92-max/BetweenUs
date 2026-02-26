/**
 * fix-heat-categories.cjs
 *
 * Corrects heat (mood) categories in dates.json so they match the rules:
 *   Heat 1 = Heart  — emotional / romantic / deep connection
 *   Heat 2 = Play   — fun / lighthearted / adventurous / anything non-sexual
 *   Heat 3 = Heat   — sexual / sensual / steamy dates ONLY
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'content', 'dates.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// ─── Heat 3 → Play 2 (not sexual, just fun/activity) ─────────────────────
const heat3toPlay = new Set([
  'd067',  // Outdoor Movie Night — movie, blankets, snacks, cuddle
  'd121',  // Couples Massage Class — professional class/workshop
  'd223',  // After-Dark Scenic Drive — driving, playlist, stargazing
  'd224',  // Secret Compliment Trail — notes with compliments
  'd227',  // Tease & Taste Charcuterie — charcuterie, feeding, dancing
  'd325',  // Morning Cuddle Playlist — cuddling with music
  'd326',  // Couples Nap Date — napping, spooning
  'd330',  // Warm and Cool Touch Massage — spa-like treatment
  'd348',  // Spooning Podcast Session — spooning, podcast
  'd359',  // Whisper Challenge Spicy Edition — party game format
  'd378',  // After-Dark Outdoor Swim — night swimming
  'd422',  // Sensual Art Studio Evening — painting/art activity
  'd425',  // Couples Karaoke and Cocktail Lab — karaoke, cocktails
  'd427',  // Thrift Store Costume Date — thrift shopping, costumes
  'd435',  // Blindfold Taste Test and Trust Walk — fun game
  'd436',  // Rainy Day Baking and Board Games — baking, games
  'd437',  // Full Moon Night Swim and Stargazing — swimming, stars
  'd442',  // Drive-In Movie and Backseat Cuddles — movie, cuddling
  'd443',  // Couples Improv and Wine Tasting — improv, wine
  'd452',  // Role-Swap Date Night — planning each other's dates
  'd505',  // Flirty Debate Night — would you rather, playful
  'd506',  // Truth or Dare Walk — walk with casual dares
  'd507',  // Couples Dance-Off — dance competition
  'd508',  // Sunset Sprint & Stargazing — racing, sunset
  'd510',  // Couples Yoga & Body Painting — yoga + art
  'd514',  // Midnight Adventure Challenge — adventure challenges
]);

// ─── Heat 3 → Heart 1 (emotional/wellness, not sexual) ───────────────────
const heat3toHeart = new Set([
  'd045',  // Bubble Bath Philosophy — deep conversation in bath
  'd047',  // Tantric Breathing Practice — breathing, eye gazing, connection
  'd078',  // Tantric Eye Gazing — eye contact, breathing, soul connection
  'd314',  // Hair Washing Ritual — caring/nurturing
  'd315',  // Hand and Foot Massage Exchange — wellness/caring
  'd317',  // Body Scan Meditation Together — meditation, wellness
  'd324',  // Warm Oil Scalp Massage — scalp care/relaxation
  'd328',  // Neck and Shoulder Unwinding — muscle relief/caring
  'd340',  // Couples Foot Soak — foot soak, talking, relaxation
  'd428',  // Home Spa and Heartfelt Playlist — spa + emotional stories
  'd456',  // Hot Tub Time Machine Conversation — deep conversation
]);

// ─── Heart 1 → Play 2 (fun activities, not emotional) ────────────────────
const heart1toPlay = new Set([
  'd001',  // Midnight Kitchen Dance Party — dance party
  'd002',  // Secret Message Treasure Hunt — treasure hunt
  'd021',  // Wine and Paint Night — painting activity
  'd030',  // Ghost Tour Adventure — ghost tour/adventure
  'd068',  // Couples Memory Palace Building — creative/mental game
  'd071',  // Couples Triathlon Training — sports training
  'd083',  // Wine Tasting Tour — wine tour activity
  'd087',  // Historic District Walk — sightseeing
  'd116',  // Couples Food Styling Workshop — food workshop
  'd118',  // Literary Speed Dating — book game format
  'd123',  // Historic Mansion Tour — touring/sightseeing
  'd133',  // Couples Creative Writing — creative activity
  'd137',  // Candle Making Workshop — craft workshop
  'd173',  // Sunrise Hot Air Balloon — adventure
  'd174',  // Couples Trivia Night — trivia game
  'd182',  // Couples Bungee Jumping — extreme adventure
  'd203',  // Couples Podcast Recording — creative/fun
  'd205',  // Couples Language Learning — learning activity
  'd207',  // Couples Budgeting Workshop — practical workshop
  'd351',  // Back Drawing Guessing Game — guessing game
  'd383',  // Couples Cave Exploration — adventure
  'd401',  // Couples Origami Session — crafting
  'd413',  // Couples Sourdough Starter — baking project
  'd416',  // Couples Around-the-World Dinner — cooking challenge
  'd447',  // Couple's Cook-Off and Critics Night — competition
  'd449',  // Pajama Brunch and Puzzle Day — brunch + puzzles
  'd466',  // Astrology Birth Chart Date — fun/exploration
  'd471',  // Homemade Pizza Night — cooking
  'd473',  // Fresh Pasta Making — cooking
  'd475',  // Backyard BBQ for Two — BBQ
  'd476',  // Ice Skating Date — fun activity
  'd479',  // Laser Tag Battle — games
  'd483',  // Planetarium Star Show — educational/fun
]);

// ─── Play 2 → Heart 1 (emotional/reflective, not just fun) ───────────────
const play2toHeart = new Set([
  'd006',  // Bookstore Poetry Exchange — poetry/emotional
  'd273',  // Childhood Photo Exchange — sharing childhood/emotional
  'd276',  // Couples Connection Card Game — deep connection prompts
  'd280',  // Life Story Interview — emotional storytelling
  'd289',  // Values Discovery Workshop — reflective/emotional
  'd290',  // Attachment Style Exploration — relationship depth
  'd295',  // Write Your Love Story — emotional
  'd297',  // Apology Language Discovery — relationship/emotional
  'd300',  // Emotional First Aid Kit — emotional
  'd301',  // Childhood Dream Revisit — reflective/emotional
  'd304',  // Cultural Heritage Sharing — sharing identity/emotional
  'd309',  // Life Regret Sharing — vulnerable/emotional
  'd344',  // Sunrise Silent Cuddling — cozy/emotional
  'd349',  // Warm Towel Ritual — caring ritual
  'd352',  // Sleepy Sunday Cocoon — cozy/emotional
]);

// ─── Apply changes ────────────────────────────────────────────────────────
let changed = 0;
const changes = [];

for (const item of data.items) {
  const id = item.id;
  const oldHeat = item.heat;
  let newHeat = oldHeat;

  if (heat3toPlay.has(id))   newHeat = 2;
  if (heat3toHeart.has(id))  newHeat = 1;
  if (heart1toPlay.has(id))  newHeat = 2;
  if (play2toHeart.has(id))  newHeat = 1;

  if (newHeat !== oldHeat) {
    const labels = { 1: 'Heart', 2: 'Play', 3: 'Heat' };
    changes.push(`  ${id}: "${item.title}" — ${labels[oldHeat]}(${oldHeat}) → ${labels[newHeat]}(${newHeat})`);
    item.heat = newHeat;
    changed++;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log(`\n✅ Fixed ${changed} dates:\n`);
changes.forEach(c => console.log(c));

// ─── Summary ──────────────────────────────────────────────────────────────
const counts = { 1: 0, 2: 0, 3: 0 };
for (const item of data.items) counts[item.heat]++;
console.log(`\nFinal counts:`);
console.log(`  Heart (1): ${counts[1]}`);
console.log(`  Play  (2): ${counts[2]}`);
console.log(`  Heat  (3): ${counts[3]}`);
console.log(`  Total:     ${data.items.length}`);

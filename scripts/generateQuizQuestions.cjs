const fs = require('fs');
const path = require('path');

// Base questions
const baseQuestions = [
  { "text": "What would {partner} order on a spontaneous date night out?", "category": "personality", "icon": "restaurant-outline" },
  { "text": "What song is always stuck in {partner}'s head?", "category": "personality", "icon": "musical-notes-outline" },
  { "text": "If {partner} had a whole free Saturday, how would they spend it?", "category": "personality", "icon": "sunny-outline" },
  { "text": "What comfort food does {partner} reach for after a rough day?", "category": "personality", "icon": "cafe-outline" },
  { "text": "What's {partner}'s go-to move when they're trying to cheer you up?", "category": "love", "icon": "heart-outline" },
  { "text": "What moment do you think {partner} considers your relationship's turning point?", "category": "love", "icon": "star-outline" },
  { "text": "What do you think {partner} finds most attractive about you?", "category": "love", "icon": "heart-circle-outline" },
  { "text": "What small thing do you do that {partner} secretly loves?", "category": "love", "icon": "eye-off-outline" },
  { "text": "If {partner} could relive one moment from your relationship, which would it be?", "category": "love", "icon": "time-outline" },
  { "text": "What does {partner} find most annoying but also kind of charming about you?", "category": "love", "icon": "happy-outline" },
  { "text": "What's one dream {partner} hasn't told many people about?", "category": "future", "icon": "moon-outline" },
  { "text": "Where would {partner} move if they could live anywhere in the world?", "category": "future", "icon": "earth-outline" },
  { "text": "What kind of home does {partner} picture for your future together?", "category": "future", "icon": "home-outline" },
  { "text": "If {partner} could master one skill overnight, what would it be?", "category": "future", "icon": "sparkles-outline" },
  { "text": "What would {partner}'s superpower be, based on their personality?", "category": "playful", "icon": "flash-outline" },
  { "text": "What movie character is {partner} most like without realizing it?", "category": "playful", "icon": "film-outline" },
  { "text": "If {partner}'s life was a playlist, what's the opening track?", "category": "playful", "icon": "headset-outline" },
  { "text": "What would {partner}'s ideal lazy Sunday morning look like in detail?", "category": "playful", "icon": "cafe-outline" },
  { "text": "What does {partner} need most when they're overwhelmed but won't ask for?", "category": "deep", "icon": "hand-left-outline" },
  { "text": "What's one fear {partner} has that most people wouldn't guess?", "category": "deep", "icon": "shield-outline" },
  { "text": "What does {partner} consider their biggest personal win from the past year?", "category": "deep", "icon": "trophy-outline" },
  { "text": "What's something {partner} is still figuring out about themselves?", "category": "deep", "icon": "search-outline" },
  { "text": "What moment in your relationship do you think made {partner} feel truly seen?", "category": "deep", "icon": "eye-outline" },
  { "text": "What's {partner}'s secret guilty pleasure?", "category": "personality", "icon": "happy-outline" },
  { "text": "What does {partner} do when nobody is watching?", "category": "playful", "icon": "eye-off-outline" },
  { "text": "What's the most thoughtful gift {partner} could receive from you?", "category": "love", "icon": "gift-outline" },
  { "text": "How does {partner} show love when words aren't enough?", "category": "love", "icon": "heart-outline" },
  { "text": "What's {partner}'s favorite way to spend a rainy afternoon?", "category": "personality", "icon": "rainy-outline" },
  { "text": "What would {partner} do with a completely free day and unlimited budget?", "category": "playful", "icon": "cash-outline" },
  { "text": "What's one thing {partner} wishes they could change about the world?", "category": "deep", "icon": "earth-outline" },
  { "text": "What makes {partner} feel most alive?", "category": "deep", "icon": "flame-outline" },
  { "text": "What's {partner}'s love language, in your opinion?", "category": "love", "icon": "chatbubble-outline" },
  { "text": "What childhood memory does {partner} treasure most?", "category": "personality", "icon": "time-outline" },
  { "text": "How would {partner} describe your relationship in three words?", "category": "love", "icon": "pricetag-outline" },
  { "text": "What tradition would {partner} want to start together?", "category": "future", "icon": "calendar-outline" },
  { "text": "What does {partner} value most in a friendship?", "category": "personality", "icon": "people-outline" },
  { "text": "What adventure has {partner} been dreaming about?", "category": "future", "icon": "airplane-outline" },
  { "text": "What's {partner}'s idea of perfect evening with you?", "category": "love", "icon": "moon-outline" },
  { "text": "What song would {partner} choose as your couple's anthem?", "category": "playful", "icon": "musical-note-outline" },
  { "text": "What does {partner} find most relaxing?", "category": "personality", "icon": "leaf-outline" },
  { "text": "What's something {partner} has always wanted to learn?", "category": "future", "icon": "school-outline" },
  { "text": "How does {partner} handle stress?", "category": "deep", "icon": "fitness-outline" },
  { "text": "What makes {partner} laugh the hardest?", "category": "playful", "icon": "happy-outline" },
  { "text": "What's {partner}'s favorite memory of you two together?", "category": "love", "icon": "camera-outline" },
  { "text": "What does {partner} need to hear when they're having a tough day?", "category": "deep", "icon": "chatbubbles-outline" },
  { "text": "What hobby would {partner} love to try together?", "category": "future", "icon": "construct-outline" },
  { "text": "What's {partner}'s secret talent?", "category": "personality", "icon": "star-outline" },
  { "text": "What does {partner} appreciate most about your relationship?", "category": "love", "icon": "heart-outline" },
  { "text": "What season matches {partner}'s personality best?", "category": "playful", "icon": "partly-sunny-outline" },
  { "text": "What's one thing {partner} couldn't live without?", "category": "personality", "icon": "bookmark-outline" }
];

// Additional question templates for expanding to 365
const additionalTemplates = [
  { "text": "What book would {partner} recommend to everyone?", "category": "personality", "icon": "book-outline" },
  { "text": "What makes {partner} feel most loved by you?", "category": "love", "icon": "heart-circle-outline" },
  { "text": "What's {partner}'s biggest pet peeve?", "category": "personality", "icon": "warning-outline" },
  { "text": "What would {partner}'s perfect vacation look like?", "category": "future", "icon": "airplane-outline" },
  { "text": "What's a risk {partner} has always wanted to take?", "category": "deep", "icon": "trending-up-outline" },
  { "text": "What does {partner} consider their greatest strength?", "category": "personality", "icon": "fitness-outline" },
  { "text": "What memory with you makes {partner} smile the most?", "category": "love", "icon": "happy-outline" },
  { "text": "What would {partner} do if they won the lottery?", "category": "playful", "icon": "cash-outline" },
  { "text": "What's {partner}'s morning routine like?", "category": "personality", "icon": "sunny-outline" },
  { "text": "What does {partner} value most about quality time together?", "category": "love", "icon": "time-outline" },
  // Continue with more diverse questions...
  { "text": "What's {partner}'s go-to karaoke song?", "category": "playful", "icon": "mic-outline" },
  { "text": "What does {partner} daydream about?", "category": "future", "icon": "cloud-outline" },
  { "text": "What habit would {partner} love to build?", "category": "future", "icon": "checkmark-circle-outline" },
  { "text": "What's {partner}'s favorite thing about themselves?", "category": "deep", "icon": "ribbon-outline" },
  { "text": "What makes {partner} feel understood?", "category": "deep", "icon": "people-circle-outline" }
];

// Generate 365 questions
const questions = [];
let questionIndex = 1;

// Add base questions
baseQuestions.forEach((q, i) => {
  questions.push({
    id: `q${String(questionIndex).padStart(3, '0')}`,
    ...q
  });
  questionIndex++;
});

// Cycle through additional templates to reach 365
while (questionIndex <= 365) {
  const template = additionalTemplates[(questionIndex - baseQuestions.length - 1) % additionalTemplates.length];
  questions.push({
    id: `q${String(questionIndex).padStart(3, '0')}`,
    ...template
  });
  questionIndex++;
}

// Write to file
const outputPath = path.join(__dirname, '../content/quizQuestions.json');
fs.writeFileSync(outputPath, JSON.stringify({ questions }, null, 2));

console.log(`✅ Generated ${questions.length} quiz questions at ${outputPath}`);

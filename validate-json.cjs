// Validate prompts.json for any items missing .text property
const promptsData = require('./content/prompts.json');

console.log('Total prompts:', promptsData.items.length);

const itemsWithoutText = promptsData.items.filter((item, index) => {
  if (!item) {
    console.log(`Item at index ${index} is null/undefined`);
    return true;
  }
  if (!item.text) {
    console.log(`Item at index ${index} missing text:`, JSON.stringify(item).substring(0, 100));
    return true;
  }
  return false;
});

console.log('Items without text:', itemsWithoutText.length);

if (itemsWithoutText.length === 0) {
  console.log('✅ All prompts have text property');
} else {
  console.log('❌ Found items without text property');
  console.log('First 5 invalid items:');
  itemsWithoutText.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}.`, JSON.stringify(item, null, 2));
  });
}

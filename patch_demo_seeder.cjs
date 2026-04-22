const fs = require('fs');

let content = fs.readFileSync('utils/DemoSeeder.js', 'utf8');

// Add imports
if (!content.includes('import Database from')) {
  content = content.replace("import SyncEngine from '../services/sync/SyncEngine';", "import SyncEngine from '../services/sync/SyncEngine';\nimport Database from '../services/db/Database';\nimport E2EEncryption from '../services/e2ee/E2EEncryption';");
}

let seedFuncStart = content.indexOf('export async function seedReviewerData() {');
let startCode = `
export async function seedReviewerData() {
  const user = await supabase.auth.getUser();
  if (!user?.data?.user?.email?.toLowerCase().includes('betweenusreviewer')) {
    console.warn('Seeder: This script is restricted to reviewer accounts only.');
    return { success: false, error: 'Restricted' };
  }
  
  const myUserId = user.data.user.id;
  const cmData = await supabase.from('couple_members').select('couple_id, user_id').eq('couple_id', (await supabase.from('couple_members').select('couple_id').eq('user_id', myUserId).single()).data?.couple_id);
  const partnerId = cmData?.data?.find(m => m.user_id !== myUserId)?.user_id || '99999999-9999-9999-9999-999999999999';
  const coupleId = cmData?.data?.[0]?.couple_id || '00000000-0000-0000-0000-000000000000';
  const kt = coupleId !== '00000000-0000-0000-0000-000000000000' ? 'couple' : 'device';
`;

content = content.replace(/export async function seedReviewerData\(\) \{[\s\S]*?console\.log\('Seeder: Starting the 90 day backfill for Alex & Jordan\.\.\.'\);/, startCode + "\n  console.log('Seeder: Starting the 90 day backfill for Alex & Jordan... (Includes partner data)');");

// Replace DataLayer calls with custom logic if Math.random() < 0.5
// Actually, it's easier to just insert partner row manually for all of them along with the user row.

fs.writeFileSync('utils/DemoSeeder.js', content);

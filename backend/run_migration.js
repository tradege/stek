const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function run() {
  const sql = fs.readFileSync('migration.sql', 'utf8');
  
  // Execute each DO block and statement separately
  const blocks = [];
  let current = '';
  const lines = sql.split('\n');
  
  for (const line of lines) {
    if (line.trim().startsWith('--')) continue;
    current += line + '\n';
    
    // Check for end of DO block or regular statement
    if (line.trim() === '$$;' || (line.trim().endsWith(';') && !current.includes('DO $$') || (current.includes('DO $$') && line.trim() === '$$;'))) {
      if (current.trim()) {
        blocks.push(current.trim());
      }
      current = '';
    }
  }
  if (current.trim()) blocks.push(current.trim());
  
  for (const block of blocks) {
    try {
      await p.$executeRawUnsafe(block);
      const preview = block.replace(/\n/g, ' ').substring(0, 70);
      console.log('OK: ' + preview);
    } catch(e) {
      const preview = block.replace(/\n/g, ' ').substring(0, 70);
      console.log('SKIP: ' + preview + ' => ' + e.message.substring(0, 100));
    }
  }
  
  // Verify
  const cols = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name='Wallet' AND column_name='bonusBalance'");
  console.log('\nbonusBalance column exists:', cols.length > 0);
  
  const tables = await p.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('RewardPool', 'RewardHistory', 'RewardPoolContribution')");
  console.log('New tables:', tables.map(t => t.table_name));
  
  const enums = await p.$queryRawUnsafe("SELECT unnest(enum_range(NULL::\"TransactionType\"))::text as val");
  console.log('TransactionType enums:', enums.map(e => e.val));
  
  await p.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });

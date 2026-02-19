const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const cols = await p.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='User' ORDER BY ordinal_position");
  console.log("=== User columns ===");
  cols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
  
  const walletCols = await p.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='Wallet' ORDER BY ordinal_position");
  console.log("\n=== Wallet columns ===");
  walletCols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
  
  const tables = await p.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log("\n=== All tables ===");
  tables.forEach(t => console.log(`  ${t.table_name}`));
  
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

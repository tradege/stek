const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  try {
    // 1. Get real users with siteId
    const users = await p.$queryRawUnsafe(
      `SELECT id, username, email, "siteId" FROM "User" WHERE "isBot" = false`
    );
    console.log("Real users:");
    users.forEach(u => console.log(`  ${u.username} (${u.email}) -> siteId: ${u.siteId}`));

    // 2. Get all SiteConfiguration entries
    const configs = await p.$queryRawUnsafe(`SELECT id, "brandName", domain, active FROM "SiteConfiguration"`);
    console.log("\nSite Configurations:");
    configs.forEach(c => console.log(`  ID ${c.id}: ${c.brandName} @ ${c.domain} (active: ${c.active})`));

    // 3. Count users per siteId
    const userCounts = await p.$queryRawUnsafe(
      `SELECT "siteId", COUNT(*) as count FROM "User" WHERE "isBot" = false GROUP BY "siteId"`
    );
    console.log("\nReal users per siteId:");
    userCounts.forEach(uc => console.log(`  siteId ${uc.siteId}: ${uc.count} users`));

    // 4. Count bots per siteId
    const botCounts = await p.$queryRawUnsafe(
      `SELECT "siteId", COUNT(*) as count FROM "User" WHERE "isBot" = true GROUP BY "siteId"`
    );
    console.log("\nBots per siteId:");
    botCounts.forEach(bc => console.log(`  siteId ${bc.siteId}: ${bc.count} bots`));

    // 5. FIX: Move ALL users from IP brand (id=2) to domain brand (id=1)
    console.log("\n--- FIXING ---");
    
    const moveResult = await p.$queryRawUnsafe(
      `UPDATE "User" SET "siteId" = '1' WHERE "siteId" = '2'`
    );
    console.log("Moved all users from brand 2 to brand 1");

    // Also move any bets, transactions, wallets that reference siteId
    // Check if other tables have siteId
    const tablesWithSiteId = await p.$queryRawUnsafe(
      `SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'siteId' AND table_schema = 'public'`
    );
    console.log("\nTables with siteId column:");
    tablesWithSiteId.forEach(t => console.log(`  ${t.table_name}.${t.column_name}`));

    // Move data in all tables that have siteId
    for (const t of tablesWithSiteId) {
      if (t.table_name === 'SiteConfiguration') continue;
      try {
        await p.$queryRawUnsafe(`UPDATE "${t.table_name}" SET "siteId" = '1' WHERE "siteId" = '2'`);
        console.log(`  Moved ${t.table_name} data from brand 2 to 1`);
      } catch (e) {
        console.log(`  Skipped ${t.table_name}: ${e.message.substring(0, 80)}`);
      }
    }

    // Delete the IP brand (id=2)
    await p.$queryRawUnsafe(`DELETE FROM "SiteConfiguration" WHERE id = '2'`);
    console.log("\nDeleted IP brand (id=2)");

    // Verify final state
    const finalConfigs = await p.$queryRawUnsafe(`SELECT id, "brandName", domain FROM "SiteConfiguration"`);
    console.log("\nFinal Site Configurations:");
    finalConfigs.forEach(c => console.log(`  ID ${c.id}: ${c.brandName} @ ${c.domain}`));

    const finalUsers = await p.$queryRawUnsafe(
      `SELECT "siteId", COUNT(*) as count FROM "User" GROUP BY "siteId"`
    );
    console.log("\nFinal user distribution:");
    finalUsers.forEach(uc => console.log(`  siteId ${uc.siteId}: ${uc.count} users`));

    console.log("\nDONE! Now need to update backend to handle IP requests as domain brand.");

  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await p.$disconnect();
  }
})();

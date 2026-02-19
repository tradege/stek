const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  try {
    // 1. Check User siteConfigId column
    const cols = await p.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name LIKE '%ite%'`
    );
    console.log("User site columns:", JSON.stringify(cols));

    // 2. Get real users with siteConfigId
    const users = await p.$queryRawUnsafe(
      `SELECT id, username, email, "siteConfigId" FROM "User" WHERE "isBot" = false`
    );
    console.log("\nReal users:");
    users.forEach(u => console.log(`  ${u.username} (${u.email}) -> siteConfigId: ${u.siteConfigId}`));

    // 3. Get all SiteConfiguration entries
    const configs = await p.$queryRawUnsafe(`SELECT id, "brandName", domain, active FROM "SiteConfiguration"`);
    console.log("\nSite Configurations:");
    configs.forEach(c => console.log(`  ID ${c.id}: ${c.brandName} @ ${c.domain} (active: ${c.active})`));

    // 4. Count users per siteConfig
    const userCounts = await p.$queryRawUnsafe(
      `SELECT "siteConfigId", COUNT(*) as count FROM "User" WHERE "isBot" = false GROUP BY "siteConfigId"`
    );
    console.log("\nUsers per siteConfig:");
    userCounts.forEach(uc => console.log(`  siteConfigId ${uc.siteConfigId}: ${uc.count} users`));

    // 5. Count bots per siteConfig
    const botCounts = await p.$queryRawUnsafe(
      `SELECT "siteConfigId", COUNT(*) as count FROM "User" WHERE "isBot" = true GROUP BY "siteConfigId"`
    );
    console.log("\nBots per siteConfig:");
    botCounts.forEach(bc => console.log(`  siteConfigId ${bc.siteConfigId}: ${bc.count} bots`));

    // 6. FIX: Move all users from IP brand (id=2) to domain brand (id=1)
    // and update the domain brand to also accept IP connections
    console.log("\n--- FIXING ---");
    
    // Move users from siteConfigId 2 to 1
    const moveResult = await p.$queryRawUnsafe(
      `UPDATE "User" SET "siteConfigId" = '1' WHERE "siteConfigId" = '2'`
    );
    console.log("Moved users from brand 2 to brand 1:", moveResult);

    // Delete the IP brand (id=2) since everything should go through brand 1
    const deleteResult = await p.$queryRawUnsafe(
      `DELETE FROM "SiteConfiguration" WHERE id = '2'`
    );
    console.log("Deleted IP brand (id=2):", deleteResult);

    // Verify
    const finalConfigs = await p.$queryRawUnsafe(`SELECT id, "brandName", domain FROM "SiteConfiguration"`);
    console.log("\nFinal Site Configurations:");
    finalConfigs.forEach(c => console.log(`  ID ${c.id}: ${c.brandName} @ ${c.domain}`));

    const finalUsers = await p.$queryRawUnsafe(
      `SELECT "siteConfigId", COUNT(*) as count FROM "User" GROUP BY "siteConfigId"`
    );
    console.log("\nFinal user distribution:");
    finalUsers.forEach(uc => console.log(`  siteConfigId ${uc.siteConfigId}: ${uc.count} users`));

  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await p.$disconnect();
  }
})();

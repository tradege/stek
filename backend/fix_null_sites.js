const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  try {
    // Assign all null siteId users to brand 1
    await p.$queryRawUnsafe("UPDATE \"User\" SET \"siteId\" = '1' WHERE \"siteId\" IS NULL");
    console.log("Fixed User null siteIds");

    await p.$queryRawUnsafe("UPDATE \"Bet\" SET \"siteId\" = '1' WHERE \"siteId\" IS NULL");
    console.log("Fixed Bet null siteIds");

    await p.$queryRawUnsafe("UPDATE \"Transaction\" SET \"siteId\" = '1' WHERE \"siteId\" IS NULL");
    console.log("Fixed Transaction null siteIds");

    await p.$queryRawUnsafe("UPDATE \"Wallet\" SET \"siteId\" = '1' WHERE \"siteId\" IS NULL");
    console.log("Fixed Wallet null siteIds");

    await p.$queryRawUnsafe("UPDATE \"BotConfig\" SET \"siteId\" = '1' WHERE \"siteId\" IS NULL");
    console.log("Fixed BotConfig null siteIds");

    // Verify
    const result = await p.$queryRawUnsafe("SELECT \"siteId\", COUNT(*) as count FROM \"User\" GROUP BY \"siteId\"");
    console.log("Final user distribution:", JSON.stringify(result));

    const configs = await p.$queryRawUnsafe("SELECT id, \"brandName\", domain FROM \"SiteConfiguration\"");
    console.log("Site configs:", JSON.stringify(configs));
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await p.$disconnect();
  }
})();

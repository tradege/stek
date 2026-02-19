const { PrismaClient } = require('./src/generated/prisma');
const p = new PrismaClient();
async function main() {
  const sites = await p.siteConfiguration.findMany({
    select: { id: true, brandName: true, domain: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log(JSON.stringify(sites, null, 2));
  await p.$disconnect();
}
main();

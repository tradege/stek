#!/usr/bin/env ts-node
/**
 * CLI: Create New Brand
 * Usage: npx ts-node scripts/create-brand.ts --name "LuckyDragon" --domain "luckydragon.com"
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };

  const brandName = getArg('--name');
  const domain = getArg('--domain');
  const primaryColor = getArg('--color') || '#6366f1';
  const botCount = parseInt(getArg('--bots') || '10');

  if (!brandName || !domain) {
    console.log('Usage: npx ts-node scripts/create-brand.ts --name "BrandName" --domain "brand.com" [--color "#hex"] [--bots 10]');
    process.exit(1);
  }

  const siteId = `site-${brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;

  console.log(`\n🏭 Creating brand: ${brandName}`);
  console.log(`   Domain: ${domain}`);
  console.log(`   SiteId: ${siteId}`);
  console.log(`   Color:  ${primaryColor}`);
  console.log(`   Bots:   ${botCount}\n`);

  // Create SiteConfiguration
  const site = await prisma.siteConfiguration.create({
    data: {
      id: siteId,
      brandName,
      domain,
      primaryColor,
      secondaryColor: '#1e1b4b',
      accentColor: '#f59e0b',
      backgroundColor: '#0f0a1e',
      surfaceColor: '#1a1535',
      textColor: '#ffffff',
      houseEdgeConfig: { dice: 0.02, crash: 0.04, mines: 0.03, plinko: 0.03, olympus: 0.04 },
      active: true,
    },
  });
  console.log('✅ SiteConfiguration created');

  // Create RiskLimit
  await prisma.riskLimit.create({
    data: { siteId, maxPayoutPerDay: 50000, maxPayoutPerBet: 10000, maxBetAmount: 5000 },
  });
  console.log('✅ RiskLimit created');

  // Create Bots
  const botNames = ['CryptoWhale', 'DiamondHands', 'MoonShot', 'BullRunner', 'SatoshiFan',
    'BlockMiner', 'TokenKing', 'DeFiPro', 'ChainLink', 'EtherBoss'];
  for (let i = 0; i < botCount; i++) {
    const name = botNames[i % botNames.length] + (i >= botNames.length ? `_${i}` : '');
    await prisma.botConfig.create({
      data: {
        siteId, botName: name, personality: ['aggressive', 'conservative', 'moderate'][i % 3],
        minBet: 5, maxBet: 500, betFrequency: 15, active: true, chatEnabled: i < 5, chatFrequency: 45,
      },
    });
  }
  console.log(`✅ ${botCount} Bots created`);

  // Output frontend config
  const config = {
    siteId,
    brandName,
    domain,
    theme: { primaryColor, secondaryColor: '#1e1b4b', accentColor: '#f59e0b' },
    houseEdge: site.houseEdgeConfig,
  };

  console.log('\n📋 Frontend Config JSON:');
  console.log(JSON.stringify(config, null, 2));

  console.log('\n📝 Next Steps:');
  console.log(`   1. Point DNS: ${domain} → 146.190.21.113`);
  console.log(`   2. SSL: certbot --nginx -d ${domain}`);
  console.log(`   3. Restart: pm2 restart stek-backend`);
  console.log('\n🎉 Brand created successfully!\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());

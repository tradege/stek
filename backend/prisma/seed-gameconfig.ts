import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed default GameConfig with 4% house edge
  const existing = await prisma.gameConfig.findUnique({ where: { key: 'default' } });
  if (!existing) {
    await prisma.gameConfig.create({
      data: {
        key: 'default',
        houseEdge: 0.04,
        config: {
          crash: 0.04,
          dice: 0.02,
          mines: 0.03,
          plinko: 0.03,
          olympus: 0.04,
          limbo: 0.04,
          penalty: 0.04,
          cardRush: 0.04,
        },
      },
    });
    console.log('✅ Default GameConfig seeded (4% house edge)');
  } else {
    console.log('GameConfig already exists, skipping seed');
  }

  // Seed default promotions
  const promoCount = await prisma.promotion.count();
  if (promoCount === 0) {
    await prisma.promotion.createMany({
      data: [
        {
          title: '🎉 Welcome Bonus',
          description: 'Get 100% deposit match up to $1,000 on your first deposit! Start your journey with double the funds.',
          type: 'DEPOSIT_BONUS',
          bonusPercent: 100,
          maxBonus: 1000,
          wagerReq: 30,
          minDeposit: 10,
          active: true,
        },
        {
          title: '🔄 Weekly Reload',
          description: 'Every Monday, get a 50% reload bonus up to $500. Keep the momentum going all week!',
          type: 'RELOAD_BONUS',
          bonusPercent: 50,
          maxBonus: 500,
          wagerReq: 25,
          minDeposit: 20,
          active: true,
        },
        {
          title: '💰 Daily Cashback',
          description: 'Get 10% cashback on net losses every day. No wagering requirements on cashback funds!',
          type: 'CASHBACK',
          bonusPercent: 10,
          maxBonus: 200,
          wagerReq: 0,
          minDeposit: 0,
          active: true,
        },
        {
          title: '🏆 VIP Level-Up Bonus',
          description: 'Earn automatic bonuses when you reach new VIP tiers. Higher levels = bigger rewards!',
          type: 'VIP_BONUS',
          bonusPercent: 0,
          maxBonus: 5000,
          wagerReq: 10,
          minDeposit: 0,
          active: true,
        },
      ],
    });
    console.log('✅ Default promotions seeded');
  } else {
    console.log('Promotions already exist, skipping seed');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

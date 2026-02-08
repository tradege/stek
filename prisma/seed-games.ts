import { PrismaClient, GameCategory, Volatility } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎰 Starting game seeding...');

  // 1. Create/Update Pragmatic Play Provider
  const pragmatic = await prisma.gameProvider.upsert({
    where: { slug: 'pragmatic' },
    update: {},
    create: {
      name: 'Pragmatic Play',
      slug: 'pragmatic',
      aggregatorId: 'pragmatic_play_001',
      aggregatorName: 'SoftSwiss',
      apiUrl: 'https://api.pragmaticplay.net',
      isActive: true,
      isLive: false,
      feePercentage: 8,
      ipWhitelist: [],
      config: {
        operatorId: 'stakepro',
        currency: 'USDT',
      },
    },
  });
  console.log(`✅ Provider created: ${pragmatic.name} (${pragmatic.id})`);

  // 2. Create/Update Evolution Provider (for Live Casino)
  const evolution = await prisma.gameProvider.upsert({
    where: { slug: 'evolution' },
    update: {},
    create: {
      name: 'Evolution Gaming',
      slug: 'evolution',
      aggregatorId: 'evolution_gaming_001',
      aggregatorName: 'SoftSwiss',
      apiUrl: 'https://api.evolution.com',
      isActive: true,
      isLive: true,
      feePercentage: 12,
      ipWhitelist: [],
      config: {
        casinoId: 'stakepro_live',
      },
    },
  });
  console.log(`✅ Provider created: ${evolution.name} (${evolution.id})`);

  // 3. Create/Update Internal Provider (for our games)
  const internal = await prisma.gameProvider.upsert({
    where: { slug: 'internal' },
    update: {},
    create: {
      name: 'StakePro Originals',
      slug: 'internal',
      apiUrl: null,
      isActive: true,
      isLive: false,
      feePercentage: 0,
      ipWhitelist: [],
      config: {
        type: 'internal',
      },
    },
  });
  console.log(`✅ Provider created: ${internal.name} (${internal.id})`);

  // 4. Create Games - Pragmatic Play Slots
  const sweetBonanza = await prisma.game.upsert({
    where: { slug: 'sweet-bonanza' },
    update: {},
    create: {
      providerId: pragmatic.id,
      externalId: 'vs20sweetbonanza',
      name: 'Sweet Bonanza',
      slug: 'sweet-bonanza',
      category: GameCategory.SLOTS,
      subcategory: 'Video Slots',
      tags: ['slot', 'popular'],
      thumbnail: '/images/games/sweet-bonanza.jpg',
      banner: '/images/games/sweet-bonanza-banner.jpg',
      description: 'Sweet Bonanza is a candy-themed slot with tumbling reels and multipliers up to 100x!',
      rtp: 96.48,
      volatility: Volatility.HIGH,
      minBet: 0.20,
      maxBet: 100,
      playCount: 0,
      isActive: true,
      isNew: false,
      isHot: true,
      isFeatured: false,
      sortOrder: 1,
    },
  });
  console.log(`✅ Game created: ${sweetBonanza.name}`);

  const gatesOfOlympus = await prisma.game.upsert({
    where: { slug: 'gates-of-olympus' },
    update: {},
    create: {
      providerId: pragmatic.id,
      externalId: 'vs20olympgate',
      name: 'Gates of Olympus',
      slug: 'gates-of-olympus',
      category: GameCategory.SLOTS,
      subcategory: 'Video Slots',
      tags: ['slot', 'popular'],
      thumbnail: '/images/games/gates-of-olympus.jpg',
      banner: '/images/games/gates-of-olympus-banner.jpg',
      description: 'Enter the realm of Zeus in this epic slot with multipliers up to 500x!',
      rtp: 96.50,
      volatility: Volatility.VERY_HIGH,
      minBet: 0.20,
      maxBet: 100,
      playCount: 0,
      isActive: true,
      isNew: false,
      isHot: true,
      isFeatured: true,
      sortOrder: 2,
    },
  });
  console.log(`✅ Game created: ${gatesOfOlympus.name}`);

  const bigBassBonanza = await prisma.game.upsert({
    where: { slug: 'big-bass-bonanza' },
    update: {},
    create: {
      providerId: pragmatic.id,
      externalId: 'vs10bbbonanza',
      name: 'Big Bass Bonanza',
      slug: 'big-bass-bonanza',
      category: GameCategory.SLOTS,
      subcategory: 'Video Slots',
      tags: ['slot', 'popular'],
      thumbnail: '/images/games/big-bass-bonanza.jpg',
      banner: '/images/games/big-bass-bonanza-banner.jpg',
      description: 'Go fishing for big wins in this popular fishing-themed slot!',
      rtp: 96.71,
      volatility: Volatility.HIGH,
      minBet: 0.10,
      maxBet: 250,
      playCount: 0,
      isActive: true,
      isNew: false,
      isHot: false,
      isFeatured: false,
      sortOrder: 3,
    },
  });
  console.log(`✅ Game created: ${bigBassBonanza.name}`);

  const bookOfDead = await prisma.game.upsert({
    where: { slug: 'book-of-dead' },
    update: {},
    create: {
      providerId: pragmatic.id,
      externalId: 'vs10bookofdead',
      name: 'Book of Dead',
      slug: 'book-of-dead',
      category: GameCategory.SLOTS,
      subcategory: 'Video Slots',
      tags: ['slot', 'popular'],
      thumbnail: '/images/games/book-of-dead.jpg',
      banner: '/images/games/book-of-dead-banner.jpg',
      description: 'Join Rich Wilde on his Egyptian adventure with expanding symbols!',
      rtp: 96.21,
      volatility: Volatility.HIGH,
      minBet: 0.10,
      maxBet: 100,
      playCount: 0,
      isActive: true,
      isNew: false,
      isHot: false,
      isFeatured: false,
      sortOrder: 4,
    },
  });
  console.log(`✅ Game created: ${bookOfDead.name}`);

  const starburst = await prisma.game.upsert({
    where: { slug: 'starburst' },
    update: {},
    create: {
      providerId: pragmatic.id,
      externalId: 'vs10starburst',
      name: 'Starburst',
      slug: 'starburst',
      category: GameCategory.SLOTS,
      subcategory: 'Video Slots',
      tags: ['slot', 'popular'],
      thumbnail: '/images/games/starburst.jpg',
      banner: '/images/games/starburst-banner.jpg',
      description: 'Classic gem-themed slot with expanding wilds and both-ways wins!',
      rtp: 96.09,
      volatility: Volatility.LOW,
      minBet: 0.10,
      maxBet: 100,
      playCount: 0,
      isActive: true,
      isNew: false,
      isHot: false,
      isFeatured: false,
      sortOrder: 5,
    },
  });
  console.log(`✅ Game created: ${starburst.name}`);

  // 5. Create Games - Evolution Live Casino
  const blackjackLive = await prisma.game.upsert({
    where: { slug: 'blackjack-live' },
    update: {},
    create: {
      providerId: evolution.id,
      externalId: 'evo_blackjack_a',
      name: 'Blackjack Live',
      slug: 'blackjack-live',
      category: GameCategory.LIVE_CASINO,
      subcategory: 'Live Table Games',
      tags: ['live', 'dealer'],
      thumbnail: '/images/games/blackjack-live.jpg',
      banner: '/images/games/blackjack-live-banner.jpg',
      description: 'Play Blackjack with real dealers in real-time!',
      rtp: 99.50,
      volatility: null,
      minBet: 5,
      maxBet: 10000,
      playCount: 0,
      isActive: true,
      isNew: false,
      isHot: false,
      isFeatured: false,
      sortOrder: 10,
    },
  });
  console.log(`✅ Game created: ${blackjackLive.name}`);

  const rouletteLive = await prisma.game.upsert({
    where: { slug: 'roulette-live' },
    update: {},
    create: {
      providerId: evolution.id,
      externalId: 'evo_roulette_a',
      name: 'Roulette Live',
      slug: 'roulette-live',
      category: GameCategory.LIVE_CASINO,
      subcategory: 'Live Table Games',
      tags: ['live', 'dealer'],
      thumbnail: '/images/games/roulette-live.jpg',
      banner: '/images/games/roulette-live-banner.jpg',
      description: 'Experience the thrill of live roulette with professional dealers!',
      rtp: 97.30,
      volatility: null,
      minBet: 1,
      maxBet: 5000,
      playCount: 0,
      isActive: true,
      isNew: false,
      isHot: false,
      isFeatured: false,
      sortOrder: 11,
    },
  });
  console.log(`✅ Game created: ${rouletteLive.name}`);

  const baccaratLive = await prisma.game.upsert({
    where: { slug: 'baccarat-live' },
    update: {},
    create: {
      providerId: evolution.id,
      externalId: 'evo_baccarat_a',
      name: 'Baccarat Live',
      slug: 'baccarat-live',
      category: GameCategory.LIVE_CASINO,
      subcategory: 'Live Table Games',
      tags: ['live', 'dealer'],
      thumbnail: '/images/games/baccarat-live.jpg',
      banner: '/images/games/baccarat-live-banner.jpg',
      description: 'Classic Baccarat with live dealers and multiple betting options!',
      rtp: 98.94,
      volatility: null,
      minBet: 5,
      maxBet: 10000,
      playCount: 0,
      isActive: true,
      isNew: false,
      isHot: false,
      isFeatured: false,
      sortOrder: 12,
    },
  });
  console.log(`✅ Game created: ${baccaratLive.name}`);

  // 6. Create Games - Internal (StakePro Originals)
  const crash = await prisma.game.upsert({
    where: { slug: 'crash' },
    update: {},
    create: {
      providerId: internal.id,
      externalId: 'internal_crash',
      name: 'Crash',
      slug: 'crash',
      category: GameCategory.CRASH,
      subcategory: 'Crash Games',
      tags: ['instant', 'provably-fair'],
      thumbnail: '/images/games/crash.jpg',
      banner: '/images/games/crash-banner.jpg',
      description: 'Watch the multiplier rise and cash out before it crashes!',
      rtp: 96.00,
      volatility: Volatility.HIGH,
      minBet: 0.10,
      maxBet: 1000,
      playCount: 0,
      isActive: true,
      isNew: false,
      isHot: true,
      isFeatured: true,
      sortOrder: 100,
    },
  });
  console.log(`✅ Game created: ${crash.name}`);

  const plinko = await prisma.game.upsert({
    where: { slug: 'plinko' },
    update: {},
    create: {
      providerId: internal.id,
      externalId: 'internal_plinko',
      name: 'Plinko',
      slug: 'plinko',
      category: GameCategory.CRASH,
      subcategory: 'Crash Games',
      tags: ['instant', 'provably-fair'],
      thumbnail: '/images/games/plinko.jpg',
      banner: '/images/games/plinko-banner.jpg',
      description: 'Drop the ball and watch it bounce to big multipliers!',
      rtp: 96.00,
      volatility: Volatility.MEDIUM,
      minBet: 0.10,
      maxBet: 100,
      playCount: 0,
      isActive: true,
      isNew: false,
      isHot: false,
      isFeatured: false,
      sortOrder: 101,
    },
  });
  console.log(`✅ Game created: ${plinko.name}`);

  const dice = await prisma.game.upsert({
    where: { slug: 'dice' },
    update: {},
    create: {
      providerId: internal.id,
      externalId: 'internal_dice',
      name: 'Dice',
      slug: 'dice',
      category: GameCategory.CRASH,
      subcategory: 'Crash Games',
      tags: ['instant', 'provably-fair'],
      thumbnail: '/images/games/dice.jpg',
      banner: '/images/games/dice-banner.jpg',
      description: 'Roll the dice and predict the outcome for instant wins!',
      rtp: 99.00,
      volatility: Volatility.LOW,
      minBet: 0.01,
      maxBet: 1000,
      playCount: 0,
      isActive: false, // Coming soon
      isNew: true,
      isHot: false,
      isFeatured: false,
      sortOrder: 102,
    },
  });
  console.log(`✅ Game created: ${dice.name}`);

  const mines = await prisma.game.upsert({
    where: { slug: 'mines' },
    update: {},
    create: {
      providerId: internal.id,
      externalId: 'internal_mines',
      name: 'Mines',
      slug: 'mines',
      category: GameCategory.CRASH,
      subcategory: 'Crash Games',
      tags: ['instant', 'provably-fair'],
      thumbnail: '/images/games/mines.jpg',
      banner: '/images/games/mines-banner.jpg',
      description: 'Navigate the minefield and collect gems for increasing multipliers!',
      rtp: 97.00,
      volatility: Volatility.MEDIUM,
      minBet: 0.10,
      maxBet: 100,
      playCount: 0,
      isActive: false, // Coming soon
      isNew: true,
      isHot: false,
      isFeatured: false,
      sortOrder: 103,
    },
  });
  console.log(`✅ Game created: ${mines.name}`);

  // Summary
  const gameCount = await prisma.game.count();
  const providerCount = await prisma.gameProvider.count();
  
  console.log('\n🎉 Seeding completed!');
  console.log(`📊 Total Providers: ${providerCount}`);
  console.log(`📊 Total Games: ${gameCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

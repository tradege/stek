/**
 * StakePro Database Seed Script
 * Creates the Super Admin user with God Mode privileges
 * 
 * Run from backend: npx ts-node ../prisma/seed.ts
 */

const { PrismaClient, UserRole, UserStatus, Currency } = require('@prisma/client');
const argon2 = require('argon2');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Super Admin Configuration
const SUPER_ADMIN = {
  email: 'marketedgepros@gmail.com',
  username: 'admin',
  password: '994499', // Will be hashed with Argon2
  displayName: 'Admin',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  hierarchyLevel: 0, // Top of pyramid
  hierarchyPath: '/admin/',
  initialBalance: 1000000.00, // $1,000,000 testing funds
};

async function main() {
  console.log('🌱 Starting StakePro Database Seed...\n');

  try {
    // ============================================
    // 1. Hash the password with Argon2
    // ============================================
    console.log('🔐 Hashing password with Argon2...');
    const passwordHash = await argon2.hash(SUPER_ADMIN.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
    console.log('   ✅ Password hashed successfully\n');

    // ============================================
    // 2. Upsert Super Admin User
    // ============================================
    console.log('👤 Creating/Updating Super Admin user...');
    console.log(`   Email: ${SUPER_ADMIN.email}`);
    console.log(`   Username: ${SUPER_ADMIN.username}`);
    console.log(`   Role: ${SUPER_ADMIN.role}`);

    const user = await prisma.user.upsert({
      where: { email: SUPER_ADMIN.email },
      update: {
        // Update existing user
        passwordHash,
        role: SUPER_ADMIN.role,
        status: SUPER_ADMIN.status,
        hierarchyLevel: SUPER_ADMIN.hierarchyLevel,
        hierarchyPath: SUPER_ADMIN.hierarchyPath,
        displayName: SUPER_ADMIN.displayName,
        // Reset commission rates for admin
        revenueSharePercent: 100, // Admin gets 100% visibility
        turnoverRebatePercent: 0,
      },
      create: {
        // Create new user
        email: SUPER_ADMIN.email,
        username: SUPER_ADMIN.username,
        passwordHash,
        role: SUPER_ADMIN.role,
        status: SUPER_ADMIN.status,
        hierarchyLevel: SUPER_ADMIN.hierarchyLevel,
        hierarchyPath: SUPER_ADMIN.hierarchyPath,
        displayName: SUPER_ADMIN.displayName,
        revenueSharePercent: 100,
        turnoverRebatePercent: 0,
      },
    });

    console.log(`   ✅ User ID: ${user.id}\n`);

    // ============================================
    // 3. Create/Update Wallet with $1M Balance
    // ============================================
    console.log('💰 Setting up wallet with testing funds...');
    console.log(`   Currency: USDT`);
    console.log(`   Balance: $${SUPER_ADMIN.initialBalance.toLocaleString()}`);

    const wallet = await prisma.wallet.upsert({
      where: {
        userId_currency: {
          userId: user.id,
          currency: Currency.USDT,
        },
      },
      update: {
        // Force set balance to $1M
        balance: SUPER_ADMIN.initialBalance,
        lockedBalance: 0,
      },
      create: {
        userId: user.id,
        currency: Currency.USDT,
        balance: SUPER_ADMIN.initialBalance,
        lockedBalance: 0,
      },
    });

    console.log(`   ✅ Wallet ID: ${wallet.id}\n`);

    // ============================================
    // 4. Create additional crypto wallets (optional)
    // ============================================
    console.log('🪙 Creating additional crypto wallets...');
    
    const additionalCurrencies = [Currency.BTC, Currency.ETH, Currency.SOL];
    
    for (const currency of additionalCurrencies) {
      await prisma.wallet.upsert({
        where: {
          userId_currency: {
            userId: user.id,
            currency,
          },
        },
        update: {},
        create: {
          userId: user.id,
          currency,
          balance: 0,
          lockedBalance: 0,
        },
      });
      console.log(`   ✅ ${currency} wallet created`);
    }

    // ============================================
    // 5. Create Server Seed for Provably Fair
    // ============================================
    console.log('\n🎲 Creating initial server seed for provably fair...');
    
    const existingSeed = await prisma.serverSeed.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    if (!existingSeed) {
      const seed = crypto.randomBytes(32).toString('hex');
      const seedHash = crypto.createHash('sha256').update(seed).digest('hex');

      await prisma.serverSeed.create({
        data: {
          userId: user.id,
          seed,
          seedHash,
          isActive: true,
          nonce: 0,
        },
      });
      console.log('   ✅ Server seed created');
    } else {
      console.log('   ⏭️ Server seed already exists');
    }

    // ============================================
    // Success Summary
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SEED COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`
📧 Email:    ${SUPER_ADMIN.email}
🔑 Password: ${SUPER_ADMIN.password}
👤 Username: ${SUPER_ADMIN.username}
👑 Role:     ${SUPER_ADMIN.role}
💰 Balance:  $${SUPER_ADMIN.initialBalance.toLocaleString()} USDT

✅ User ${SUPER_ADMIN.email} created with $1M balance. Ready to login.
`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

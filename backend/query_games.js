const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const crashCount = await p.crashGame.count();
  const plinkoCount = await p.plinkoGame.count();
  
  const crashGames = await p.crashGame.findMany({
    select: { betAmount: true, multiplier: true, payout: true, profit: true, status: true },
    take: 1000,
    orderBy: { createdAt: "desc" }
  });
  
  const plinkoGames = await p.plinkoGame.findMany({
    select: { betAmount: true, multiplier: true, payout: true, profit: true },
    take: 1000,
    orderBy: { createdAt: "desc" }
  });

  // Calculate totals
  let crashTotalBet = 0, crashTotalPayout = 0, crashTotalProfit = 0;
  for (const g of crashGames) {
    crashTotalBet += parseFloat(g.betAmount) || 0;
    crashTotalPayout += parseFloat(g.payout) || 0;
    crashTotalProfit += parseFloat(g.profit) || 0;
  }

  let plinkoTotalBet = 0, plinkoTotalPayout = 0, plinkoTotalProfit = 0;
  for (const g of plinkoGames) {
    plinkoTotalBet += parseFloat(g.betAmount) || 0;
    plinkoTotalPayout += parseFloat(g.payout) || 0;
    plinkoTotalProfit += parseFloat(g.profit) || 0;
  }

  // Also get user balances
  const users = await p.user.findMany({
    select: { username: true, email: true, balance: true, role: true, isBot: true }
  });

  let totalUserBalance = 0, botCount = 0, realCount = 0;
  for (const u of users) {
    totalUserBalance += parseFloat(u.balance) || 0;
    if (u.isBot) botCount++;
    else realCount++;
  }

  console.log(JSON.stringify({
    crashCount, plinkoCount,
    crash: {
      totalBet: crashTotalBet.toFixed(2),
      totalPayout: crashTotalPayout.toFixed(2),
      totalProfit: crashTotalProfit.toFixed(2),
      houseEdge: crashTotalBet > 0 ? ((1 - crashTotalPayout / crashTotalBet) * 100).toFixed(2) + "%" : "N/A",
      sample: crashGames.slice(0, 3)
    },
    plinko: {
      totalBet: plinkoTotalBet.toFixed(2),
      totalPayout: plinkoTotalPayout.toFixed(2),
      totalProfit: plinkoTotalProfit.toFixed(2),
      houseEdge: plinkoTotalBet > 0 ? ((1 - plinkoTotalPayout / plinkoTotalBet) * 100).toFixed(2) + "%" : "N/A",
      sample: plinkoGames.slice(0, 3)
    },
    users: {
      total: users.length,
      bots: botCount,
      real: realCount,
      totalBalance: totalUserBalance.toFixed(2),
      topUsers: users.filter(u => !u.isBot).slice(0, 5).map(u => ({
        username: u.username, email: u.email, balance: u.balance, role: u.role
      }))
    }
  }, null, 2));
}

main().catch(e => console.log(JSON.stringify({error: e.message}))).finally(() => p.$disconnect());

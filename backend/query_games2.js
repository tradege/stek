const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  // Count bets by game type
  const crashBets = await p.bet.findMany({ where: { gameType: "CRASH" }, orderBy: { createdAt: "desc" }, take: 2000 });
  const plinkoBets = await p.bet.findMany({ where: { gameType: "PLINKO" }, orderBy: { createdAt: "desc" }, take: 2000 });
  const allBets = await p.bet.count();
  
  // Crash analysis
  let cBet = 0, cPayout = 0, cProfit = 0;
  for (const b of crashBets) {
    cBet += parseFloat(b.amount) || 0;
    cPayout += parseFloat(b.payout) || 0;
    cProfit += parseFloat(b.profit) || 0;
  }

  // Plinko analysis
  let pBet = 0, pPayout = 0, pProfit = 0;
  for (const b of plinkoBets) {
    pBet += parseFloat(b.amount) || 0;
    pPayout += parseFloat(b.payout) || 0;
    pProfit += parseFloat(b.profit) || 0;
  }

  // Users
  const users = await p.user.findMany({
    select: { id: true, username: true, email: true, balance: true, role: true, isBot: true }
  });
  
  let totalBal = 0, bots = 0, reals = 0;
  const realUsers = [];
  for (const u of users) {
    totalBal += parseFloat(u.balance) || 0;
    if (u.isBot) bots++; else { reals++; realUsers.push(u); }
  }

  // Bet count by game type
  const crashCount = crashBets.length;
  const plinkoCount = plinkoBets.length;

  console.log(JSON.stringify({
    totalBets: allBets,
    crash: {
      count: crashCount,
      totalBet: cBet.toFixed(2),
      totalPayout: cPayout.toFixed(2),
      playerProfit: cProfit.toFixed(2),
      houseProfit: (cBet - cPayout).toFixed(2),
      houseEdge: cBet > 0 ? ((1 - cPayout / cBet) * 100).toFixed(2) + "%" : "N/A",
      sample: crashBets.slice(0, 3).map(b => ({ amount: b.amount, payout: b.payout, profit: b.profit, multiplier: b.multiplier, gameData: b.gameData }))
    },
    plinko: {
      count: plinkoCount,
      totalBet: pBet.toFixed(2),
      totalPayout: pPayout.toFixed(2),
      playerProfit: pProfit.toFixed(2),
      houseProfit: (pBet - pPayout).toFixed(2),
      houseEdge: pBet > 0 ? ((1 - pPayout / pBet) * 100).toFixed(2) + "%" : "N/A",
      sample: plinkoBets.slice(0, 3).map(b => ({ amount: b.amount, payout: b.payout, profit: b.profit, multiplier: b.multiplier, gameData: b.gameData }))
    },
    users: {
      total: users.length,
      bots: bots,
      real: reals,
      totalBalance: totalBal.toFixed(2),
      realUsers: realUsers.slice(0, 10).map(u => ({ username: u.username, email: u.email, balance: parseFloat(u.balance).toFixed(2), role: u.role }))
    }
  }, null, 2));
}

main().catch(e => console.log(JSON.stringify({error: e.message}))).finally(() => p.$disconnect());

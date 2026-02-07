const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  // Get all bets
  const crashBets = await p.bet.findMany({ where: { gameType: "CRASH" }, orderBy: { createdAt: "desc" }, take: 5000 });
  const plinkoBets = await p.bet.findMany({ where: { gameType: "PLINKO" }, orderBy: { createdAt: "desc" }, take: 5000 });
  const totalBets = await p.bet.count();

  // Crash analysis
  let cBet = 0, cPayout = 0, cProfit = 0, cWins = 0;
  for (const b of crashBets) {
    cBet += parseFloat(b.betAmount) || 0;
    cPayout += parseFloat(b.payout) || 0;
    cProfit += parseFloat(b.profit) || 0;
    if (b.isWin) cWins++;
  }

  // Plinko analysis
  let pBet = 0, pPayout = 0, pProfit = 0, pWins = 0;
  for (const b of plinkoBets) {
    pBet += parseFloat(b.betAmount) || 0;
    pPayout += parseFloat(b.payout) || 0;
    pProfit += parseFloat(b.profit) || 0;
    if (b.isWin) pWins++;
  }

  // Users with wallets
  const users = await p.user.findMany({
    select: { id: true, username: true, email: true, role: true, isBot: true, wallets: { select: { balance: true, currency: true } } }
  });

  let bots = 0, reals = 0, totalBal = 0;
  const realUsers = [];
  for (const u of users) {
    const bal = u.wallets.reduce((s, w) => s + (parseFloat(w.balance) || 0), 0);
    if (u.isBot) bots++; else { reals++; realUsers.push({ ...u, totalBalance: bal }); }
    totalBal += bal;
  }

  console.log(JSON.stringify({
    totalBets,
    crash: {
      count: crashBets.length,
      totalBet: cBet.toFixed(2),
      totalPayout: cPayout.toFixed(2),
      playerProfit: cProfit.toFixed(2),
      houseProfit: (cBet - cPayout).toFixed(2),
      houseEdgeActual: cBet > 0 ? ((1 - cPayout / cBet) * 100).toFixed(2) + "%" : "N/A",
      winRate: crashBets.length > 0 ? ((cWins / crashBets.length) * 100).toFixed(1) + "%" : "N/A",
      sample: crashBets.slice(0, 5).map(b => ({ bet: parseFloat(b.betAmount).toFixed(2), payout: parseFloat(b.payout).toFixed(2), profit: parseFloat(b.profit).toFixed(2), mult: parseFloat(b.multiplier).toFixed(2), win: b.isWin }))
    },
    plinko: {
      count: plinkoBets.length,
      totalBet: pBet.toFixed(2),
      totalPayout: pPayout.toFixed(2),
      playerProfit: pProfit.toFixed(2),
      houseProfit: (pBet - pPayout).toFixed(2),
      houseEdgeActual: pBet > 0 ? ((1 - pPayout / pBet) * 100).toFixed(2) + "%" : "N/A",
      winRate: plinkoBets.length > 0 ? ((pWins / plinkoBets.length) * 100).toFixed(1) + "%" : "N/A",
      sample: plinkoBets.slice(0, 5).map(b => ({ bet: parseFloat(b.betAmount).toFixed(2), payout: parseFloat(b.payout).toFixed(2), profit: parseFloat(b.profit).toFixed(2), mult: parseFloat(b.multiplier).toFixed(2), win: b.isWin }))
    },
    users: {
      total: users.length,
      bots,
      real: reals,
      totalBalance: totalBal.toFixed(2),
      realUsers: realUsers.slice(0, 10).map(u => ({ username: u.username, email: u.email, balance: u.totalBalance.toFixed(2), role: u.role }))
    },
    overall: {
      totalWagered: (cBet + pBet).toFixed(2),
      totalPaidOut: (cPayout + pPayout).toFixed(2),
      totalHouseProfit: ((cBet - cPayout) + (pBet - pPayout)).toFixed(2),
      overallHouseEdge: (cBet + pBet) > 0 ? ((1 - (cPayout + pPayout) / (cBet + pBet)) * 100).toFixed(2) + "%" : "N/A"
    }
  }, null, 2));
}

main().catch(e => console.log(JSON.stringify({error: e.message}))).finally(() => p.$disconnect());

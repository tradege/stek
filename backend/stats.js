
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function main() {
  // Get all bets
  const bets = await p.bet.findMany();
  let totalBetAmount = 0, totalPayout = 0, totalProfit = 0;
  for (const b of bets) {
    totalBetAmount += parseFloat(b.betAmount) || 0;
    totalPayout += parseFloat(b.payout) || 0;
    totalProfit += parseFloat(b.profit) || 0;
  }
  
  // Get all wallets
  const wallets = await p.wallet.findMany();
  let totalBalance = 0;
  for (const w of wallets) {
    totalBalance += parseFloat(w.balance) || 0;
  }
  
  // Get all transactions
  const txs = await p.transaction.findMany();
  let totalDeposits = 0, totalWithdrawals = 0;
  for (const t of txs) {
    if (t.type === "DEPOSIT") totalDeposits += parseFloat(t.amount) || 0;
    if (t.type === "WITHDRAWAL") totalWithdrawals += parseFloat(t.amount) || 0;
  }
  
  console.log(JSON.stringify({
    bets: { count: bets.length, totalBetAmount: totalBetAmount.toFixed(2), totalPayout: totalPayout.toFixed(2), totalProfit: totalProfit.toFixed(2), houseEdge: ((1 - totalPayout/totalBetAmount) * 100).toFixed(2) + "%" },
    wallets: { count: wallets.length, totalBalance: totalBalance.toFixed(2) },
    transactions: { count: txs.length, totalDeposits: totalDeposits.toFixed(2), totalWithdrawals: totalWithdrawals.toFixed(2) },
    realHouseProfit: (totalDeposits - totalBalance).toFixed(2),
    realHouseProfitFromBets: (totalBetAmount - totalPayout).toFixed(2)
  }, null, 2));
}
main().catch(e => console.log(JSON.stringify({error: e.message}))).finally(function() { return p.$disconnect(); });

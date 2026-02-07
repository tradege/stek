
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function main() {
  const bets = await p.bet.findMany({ where: { gameType: "PLINKO" }, take: 5000 });
  let mults = {};
  let totalBet = 0, totalPayout = 0;
  let betWeightedMult = 0;
  
  for (const b of bets) {
    const mult = parseFloat(b.multiplier) || 0;
    const bet = parseFloat(b.betAmount) || 0;
    const payout = parseFloat(b.payout) || 0;
    const key = mult.toFixed(2);
    mults[key] = (mults[key] || 0) + 1;
    totalBet += bet;
    totalPayout += payout;
    betWeightedMult += mult * bet;
  }
  
  // Sort by multiplier value
  const sorted = Object.entries(mults).sort((a,b) => parseFloat(a[0]) - parseFloat(b[0]));
  
  console.log(JSON.stringify({
    totalGames: bets.length,
    totalBet: totalBet.toFixed(2),
    totalPayout: totalPayout.toFixed(2),
    houseEdge: ((1 - totalPayout/totalBet) * 100).toFixed(2) + "%",
    betWeightedEV: (betWeightedMult / totalBet).toFixed(4),
    allMultipliers: sorted,
    uniqueMultCount: sorted.length
  }, null, 2));
}
main().catch(e => console.log(JSON.stringify({error: e.message}))).finally(function() { return p.$disconnect(); });

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function main() {
  const crashBets = await p.bet.findMany({ where: { gameType: "CRASH" }, take: 5000 });
  
  let busted = 0, cashedOut = 0;
  let crashMultipliers = [];
  let cashoutMultipliers = [];
  
  for (const b of crashBets) {
    const mult = parseFloat(b.multiplier) || 0;
    const payout = parseFloat(b.payout) || 0;
    
    if (payout === 0) {
      busted++;
    } else {
      cashedOut++;
      cashoutMultipliers.push(mult);
    }
    
    if (b.gameData) {
      const gd = typeof b.gameData === "string" ? JSON.parse(b.gameData) : b.gameData;
      if (gd.crashPoint) crashMultipliers.push(parseFloat(gd.crashPoint));
      if (gd.crashMultiplier) crashMultipliers.push(parseFloat(gd.crashMultiplier));
    }
  }
  
  const plinkoBets = await p.bet.findMany({ where: { gameType: "PLINKO" }, take: 5000 });
  let plinkoMults = {};
  let bigBets = [];
  
  for (const b of plinkoBets) {
    const mult = parseFloat(b.multiplier) || 0;
    const bet = parseFloat(b.betAmount) || 0;
    const key = mult.toFixed(2);
    plinkoMults[key] = (plinkoMults[key] || 0) + 1;
    
    if (bet > 10000) {
      bigBets.push({ bet: bet.toFixed(2), mult: mult.toFixed(2), payout: parseFloat(b.payout).toFixed(2), profit: parseFloat(b.profit).toFixed(2) });
    }
  }
  
  const sortedMults = Object.entries(plinkoMults).sort((a,b) => b[1] - a[1]).slice(0, 15);
  
  console.log(JSON.stringify({
    crash: {
      total: crashBets.length,
      busted: busted,
      cashedOut: cashedOut,
      bustRate: (busted / crashBets.length * 100).toFixed(1) + "%",
      avgCashoutMult: cashoutMultipliers.length > 0 ? (cashoutMultipliers.reduce((a,b)=>a+b,0) / cashoutMultipliers.length).toFixed(2) : "N/A",
      crashPointsSample: crashMultipliers.slice(0, 20)
    },
    plinko: {
      total: plinkoBets.length,
      multiplierDistribution: sortedMults,
      bigBets: bigBets.slice(0, 10)
    }
  }, null, 2));
}
main().catch(e => console.log(JSON.stringify({error: e.message}))).finally(function() { return p.$disconnect(); });

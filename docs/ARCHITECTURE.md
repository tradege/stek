# StakePro - System Architecture

## 🎰 Overview

**StakePro** is a high-performance Crypto Casino platform with a deep MLM/Agent system, designed to handle 10,000+ bets per second with zero latency.

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | **Node.js + NestJS** | Fastest for real-time, TypeScript native |
| **Database** | **PostgreSQL** | ACID transactions, complex queries |
| **Cache** | **Redis** | Real-time balances, PubSub, rate limiting |
| **Real-time** | **Socket.io** | Live graphs, chat, notifications |
| **Frontend** | **Next.js + React** | SSR, fast SPA, Stake-like feel |
| **Queue** | **Redis Streams / BullMQ** | Commission distribution, async tasks |

### Why NestJS over FastAPI?
- Native TypeScript (same as frontend)
- Better WebSocket support
- Dependency injection built-in
- Faster for I/O-bound operations (which is 99% of casino ops)

---

## 👥 User Hierarchy (MLM/Agent System)

```
                    ┌─────────────┐
                    │   ADMIN     │  Level 0
                    │ Full Control│
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │SUPER MASTER │ │SUPER MASTER │ │SUPER MASTER │  Level 1
    │  Country A  │ │  Country B  │ │  Country C  │
    └──────┬──────┘ └──────┬──────┘ └─────────────┘
           │               │
    ┌──────▼──────┐ ┌──────▼──────┐
    │   MASTER    │ │   MASTER    │  Level 2
    │  Group 1    │ │  Group 2    │
    └──────┬──────┘ └─────────────┘
           │
    ┌──────▼──────┐
    │   AGENT     │  Level 3
    │  Team Lead  │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │    USER     │  Level 4
    │   Player    │
    └─────────────┘
```

### Hierarchy Path Implementation

Each user stores their full hierarchy path for efficient queries:

```sql
-- Example hierarchy paths:
-- Admin:        /
-- Super Master: /admin-uuid/
-- Master:       /admin-uuid/super-uuid/
-- Agent:        /admin-uuid/super-uuid/master-uuid/
-- User:         /admin-uuid/super-uuid/master-uuid/agent-uuid/
```

**Query all descendants:**
```sql
SELECT * FROM users WHERE hierarchy_path LIKE '/admin-uuid/super-uuid/%';
```

**Query all ancestors:**
```sql
-- Parse hierarchy_path and query by IDs
```

---

## 💰 Commission System

### Two Types of Commissions:

| Type | Description | Calculation |
|------|-------------|-------------|
| **Revenue Share** | % of house edge | `houseEdge * revenueSharePercent` |
| **Turnover Rebate** | % of total bet | `betAmount * turnoverRebatePercent` |

### Commission Distribution Flow

```
Player bets $100 on Crash
House Edge = 3% = $3
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│              COMMISSION DISTRIBUTION                     │
├─────────────────────────────────────────────────────────┤
│ Agent (Direct Parent)     │ 30% of $3 = $0.90          │
│ Master (Level 2)          │ 20% of $3 = $0.60          │
│ Super Master (Level 3)    │ 10% of $3 = $0.30          │
│ House (Remaining)         │ 40% of $3 = $1.20          │
└─────────────────────────────────────────────────────────┘
```

### Implementation (Async with Redis Streams)

```typescript
// On every bet settlement
async function distributeCommissions(bet: Bet) {
  const ancestors = await getAncestors(bet.userId);
  
  for (const ancestor of ancestors) {
    const commission = calculateCommission(bet, ancestor);
    
    // Add to Redis Stream for async processing
    await redis.xadd('commissions:pending', '*', {
      recipientId: ancestor.id,
      betId: bet.id,
      amount: commission.amount,
      type: commission.type,
    });
  }
}

// Worker processes commissions
async function processCommissionWorker() {
  while (true) {
    const entries = await redis.xread('commissions:pending');
    for (const entry of entries) {
      await creditWallet(entry.recipientId, entry.amount);
      await saveCommissionRecord(entry);
    }
  }
}
```

---

## 🔐 Race Condition Prevention

### The Problem

With 10,000+ bets/sec, multiple requests can try to deduct from the same balance simultaneously:

```
Time 0: Balance = $100
Time 1: Request A reads balance = $100
Time 2: Request B reads balance = $100
Time 3: Request A bets $80, writes balance = $20
Time 4: Request B bets $80, writes balance = $20  ← WRONG! Should fail!
```

### Solution: Redis + Lua Atomic Operations

**All balance operations use Redis Lua scripts for atomicity:**

```lua
-- bet_atomic.lua
-- Atomically check and deduct balance

local balance_key = KEYS[1]
local locked_key = KEYS[2]
local bet_amount = tonumber(ARGV[1])
local bet_id = ARGV[2]

-- Get current balance
local balance = tonumber(redis.call('GET', balance_key) or '0')

-- Check if sufficient
if balance < bet_amount then
  return {err = 'INSUFFICIENT_BALANCE', balance = balance}
end

-- Atomic deduction
local new_balance = balance - bet_amount
redis.call('SET', balance_key, new_balance)

-- Lock the bet amount
redis.call('HSET', locked_key, bet_id, bet_amount)

return {ok = true, new_balance = new_balance}
```

### Balance Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    REDIS (Real-time)                     │
├─────────────────────────────────────────────────────────┤
│  wallet:{userId}:{currency}:balance    → "1.23456789"   │
│  wallet:{userId}:{currency}:locked     → {betId: amt}   │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Async sync (every 100ms or on demand)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  POSTGRESQL (Persistence)                │
├─────────────────────────────────────────────────────────┤
│  wallets table: balance, locked_balance                  │
│  transactions table: full history                        │
└─────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
@Injectable()
export class WalletService {
  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  async placeBet(userId: string, currency: Currency, amount: Decimal, betId: string): Promise<BetResult> {
    const balanceKey = `wallet:${userId}:${currency}:balance`;
    const lockedKey = `wallet:${userId}:${currency}:locked`;

    // Atomic Lua script execution
    const result = await this.redis.eval(
      BET_ATOMIC_SCRIPT,
      [balanceKey, lockedKey],
      [amount.toString(), betId]
    );

    if (result.err) {
      throw new InsufficientBalanceError(result.balance);
    }

    // Async persist to PostgreSQL
    this.persistTransaction(userId, currency, amount, 'BET', betId);

    return { success: true, newBalance: result.new_balance };
  }

  async settleBet(betId: string, payout: Decimal): Promise<void> {
    // Release locked amount + add payout
    const result = await this.redis.eval(
      SETTLE_BET_SCRIPT,
      [balanceKey, lockedKey],
      [betId, payout.toString()]
    );

    // Trigger commission distribution
    await this.commissionQueue.add('distribute', { betId });
  }
}
```

### Additional Safeguards

| Safeguard | Implementation |
|-----------|----------------|
| **Optimistic Locking** | Version field on wallet, reject if changed |
| **Idempotency Keys** | Each bet has unique ID, prevent double-processing |
| **Rate Limiting** | Max 100 bets/sec per user via Redis |
| **Circuit Breaker** | If Redis fails, reject bets (don't fall back to DB) |

---

## 🎲 Provably Fair System

### Algorithm

```
Result = HMAC_SHA256(serverSeed, clientSeed + ":" + nonce)
```

### Flow

```
1. Server generates serverSeed, shows SHA256(serverSeed) to player
2. Player sets their clientSeed
3. Each bet increments nonce
4. Result calculated from combined seeds
5. After seed rotation, server reveals serverSeed for verification
```

### Implementation

```typescript
function calculateGameResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  gameType: GameType
): GameResult {
  const combined = `${clientSeed}:${nonce}`;
  const hash = crypto.createHmac('sha256', serverSeed).update(combined).digest('hex');
  
  // Convert hash to game-specific result
  switch (gameType) {
    case 'CRASH':
      return calculateCrashPoint(hash);
    case 'DICE':
      return calculateDiceRoll(hash);
    case 'MINES':
      return calculateMinePositions(hash);
    // ...
  }
}

function calculateCrashPoint(hash: string): number {
  // Use first 52 bits of hash
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);
  
  // 3% house edge
  const houseEdge = 0.03;
  const result = (1 - houseEdge) * e / (e - h);
  
  return Math.max(1, Math.floor(result * 100) / 100);
}
```

---

## 📁 Project Structure

```
stakepro/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/           # JWT, 2FA, sessions
│   │   │   ├── users/          # User CRUD, hierarchy
│   │   │   ├── wallets/        # Balance, deposits, withdrawals
│   │   │   ├── games/          # Game logic, provably fair
│   │   │   │   ├── crash/
│   │   │   │   ├── plinko/
│   │   │   │   ├── mines/
│   │   │   │   └── dice/
│   │   │   ├── commissions/    # MLM distribution
│   │   │   ├── social/         # Tips, Rain, Chat
│   │   │   └── admin/          # Admin panel APIs
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── decorators/
│   │   │   └── filters/
│   │   ├── redis/              # Redis service, Lua scripts
│   │   ├── websocket/          # Socket.io gateway
│   │   └── prisma/             # Database client
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js app router
│   │   ├── components/
│   │   │   ├── games/
│   │   │   ├── wallet/
│   │   │   ├── chat/
│   │   │   └── ui/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── styles/
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── PROVABLY_FAIR.md
└── docker-compose.yml
```

---

## 🚀 Performance Targets

| Metric | Target |
|--------|--------|
| Bets per second | 10,000+ |
| Bet latency | < 50ms |
| WebSocket latency | < 10ms |
| Balance update | Real-time (Redis) |
| Commission distribution | < 100ms async |

---

## 🔒 Security Considerations

1. **All crypto operations server-side** (never expose private keys)
2. **Rate limiting** on all endpoints
3. **2FA mandatory** for withdrawals
4. **IP whitelisting** for admin/agent roles
5. **Audit logging** for all financial operations
6. **Encrypted seeds** in database

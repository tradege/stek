# 🎰 StakePro

**High-Performance Crypto Casino with Deep MLM/Agent System**

---

## 🚀 Features

### 👥 MLM/Agent Hierarchy (5 Levels)
- **Admin** - Full system control
- **Super Master** - Country/Region manager with credit lines
- **Master** - Group manager
- **Agent** - Direct player manager
- **User** - The player

### 💰 Financial Engine
- **Multi-Currency Wallet** - BTC, ETH, USDT, SOL
- **Vault** - Savings with interest
- **Tipping** - P2P transfers
- **Rain** - Chat bonuses
- **Real-time balances** - Redis-powered, 10,000+ bets/sec

### 🎲 Games (Provably Fair)
- Crash
- Plinko
- Mines
- Dice
- Limbo
- Keno
- Wheel
- And more...

### 📊 Commission System
- **Revenue Share** - % of house edge
- **Turnover Rebate** - % of total bets
- **Instant distribution** up the hierarchy chain

---

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + NestJS |
| Database | PostgreSQL |
| Cache | Redis |
| Real-time | Socket.io |
| Frontend | Next.js + React |
| Queue | BullMQ |

---

## 📁 Project Structure

```
stakepro/
├── backend/          # NestJS API server
├── frontend/         # Next.js web app
├── prisma/           # Database schema
└── docs/             # Documentation
```

---

## 🔧 Getting Started

```bash
# Install dependencies
cd backend && pnpm install
cd ../frontend && pnpm install

# Setup database
cd ../backend
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate

# Start development
pnpm start:dev
```

---

## 📖 Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [Provably Fair](./docs/PROVABLY_FAIR.md)

---

## 🔐 Security

- Atomic balance operations (Redis Lua)
- Race condition prevention
- 2FA for withdrawals
- Audit logging
- Rate limiting

---

## 📄 License

Proprietary - All Rights Reserved

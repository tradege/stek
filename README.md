# STEK Platform - Multi-Tenant White-Label Casino

## Architecture Overview

STEK is a **multi-tenant white-label casino platform** built with:
- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Real-time**: Socket.IO for live game updates
- **Process Manager**: PM2

### Key Features
- Multi-brand support from a single codebase
- Dynamic theming per brand (colors, logos, assets)
- Per-brand house edge configuration
- Isolated user data, wallets, and bets per brand
- Automated brand onboarding (Brand Factory)
- GGR/NGR revenue tracking per brand
- Fraud detection system
- Bot system per brand
- Affiliate/MLM system per brand

---

## Quick Start

### Server Access
```bash
ssh root@146.190.21.113
cd /var/www/stek
```

### Services
```bash
pm2 status              # Check all services
pm2 restart stek-backend  # Restart backend
pm2 restart stek-frontend # Restart frontend
pm2 logs stek-backend     # View backend logs
```

### API Documentation
- **Swagger UI**: https://marketedgepros.com/api/docs
- **Swagger JSON**: https://marketedgepros.com/api/docs-json

---

## How to Add a New Brand

### Option 1: Via Admin API (Recommended)
```bash
# Login as admin
TOKEN=$(curl -s https://marketedgepros.com/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"marketedgepros@gmail.com","password":"Admin99449x"}' \
  | jq -r '.token')

# Create new brand
curl -X POST https://marketedgepros.com/admin/brands/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "brandName": "LuckyDragon",
    "domain": "luckydragon.com",
    "primaryColor": "#ff6600",
    "secondaryColor": "#1a1a2e",
    "accentColor": "#f59e0b",
    "maxPayoutPerDay": 50000,
    "maxPayoutPerBet": 10000,
    "maxBetAmount": 5000,
    "botNamePrefix": "LD_",
    "houseEdgeConfig": {
      "dice": 0.02,
      "crash": 0.04,
      "mines": 0.03,
      "plinko": 0.03,
      "olympus": 0.04
    }
  }'
```

The API returns:
- `siteId` - Unique brand identifier
- `frontendConfig` - Full config for frontend deployment
- `nextSteps` - DNS, SSL, and nginx setup instructions

### Option 2: Via CLI Script
```bash
cd /var/www/stek/backend
node scripts/create-brand.js \
  --name "LuckyDragon" \
  --domain "luckydragon.com" \
  --color "#ff6600"
```

### Post-Creation Steps
1. **DNS**: Point domain A record to `146.190.21.113`
2. **SSL**: `certbot --nginx -d luckydragon.com`
3. **Nginx**: Add server block (copy from existing and change `server_name`)
4. **Logo**: Upload to `/var/www/stek/frontend/public/assets/brands/{siteId}/`
5. **Restart**: `pm2 restart all`

---

## How to Monitor GGR (Gross Gaming Revenue)

### Per-Brand Dashboard
```bash
curl -s "https://marketedgepros.com/admin/dashboard?siteId=default-site-001" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Response includes:
```json
{
  "siteId": "default-site-001",
  "brandName": "StakePro",
  "revenue": {
    "today": {
      "totalBets": 1234.56,
      "totalWins": 987.65,
      "ggr": 246.91,
      "ngr": 221.22,
      "betCount": 150,
      "uniquePlayers": 45
    },
    "allTime": {
      "totalBets": 5000000,
      "totalWins": 4500000,
      "ggr": 500000,
      "ngr": 450000,
      "betCount": 50000,
      "uniquePlayers": 134
    }
  },
  "gameBreakdown": [
    { "game": "CRASH", "bets": 2500000, "wins": 2250000, "ggr": 250000, "rtp": 90.0 },
    { "game": "DICE", "bets": 1000000, "wins": 950000, "ggr": 50000, "rtp": 95.0 }
  ]
}
```

### GGR Formulas
- **GGR** = Total Bets - Total Wins
- **NGR** = GGR - Bonuses - Commissions (10% default deduction)
- **RTP** = (Total Wins / Total Bets) x 100

### All-Brands Overview
```bash
curl -s "https://marketedgepros.com/admin/dashboard/all-brands" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## How to Change House Edge

### Per-Brand House Edge
```bash
curl -X PUT "https://marketedgepros.com/admin/house-edge/default-site-001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dice": 0.05,
    "crash": 0.06,
    "mines": 0.04,
    "plinko": 0.04,
    "olympus": 0.05
  }'
```

**Important**: Changes take effect immediately for new bets. Each brand has independent house edge settings.

### Risk Limits
```bash
curl -X PUT "https://marketedgepros.com/admin/risk-limits/default-site-001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxPayoutPerDay": 100000,
    "maxPayoutPerBet": 25000,
    "maxBetAmount": 10000
  }'
```

---

## How to Respond to Fraud Alerts

### Scan for Fraud
```bash
curl -s "https://marketedgepros.com/admin/fraud/scan/default-site-001" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### View Active Alerts
```bash
curl -s "https://marketedgepros.com/admin/fraud/alerts?siteId=default-site-001" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Alert Types
| Type | Description | Threshold |
|------|-------------|-----------|
| `HIGH_WIN_RATE` | Win rate > 80% over 50+ bets | Suspicious |
| `RAPID_BETTING` | Too many bets in short time | Bot activity |
| `LARGE_WITHDRAWAL` | Withdrawal > 80% of balance | Money laundering |
| `SUSPICIOUS_RATIO` | Win/bet ratio anomaly | Exploitation |

### Respond to Alert
```bash
curl -X PUT "https://marketedgepros.com/admin/fraud/alerts/{alertId}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "REVIEWED", "notes": "Checked - legitimate player"}'
```

Status options: `OPEN`, `REVIEWED`, `DISMISSED`, `CONFIRMED`

---

## System Health Monitoring

### Public Health Check
```bash
curl https://marketedgepros.com/system/health
```

### Detailed Health (Admin)
```bash
curl -s "https://marketedgepros.com/system/health/detailed" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

Returns: DB status, memory usage, total users, total bets, active sites, open fraud alerts, per-brand stats.

---

## API Endpoints Reference

### Public (No Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/system/health` | System health check |
| GET | `/api/v1/tenants/by-domain?domain=X` | Get brand config by domain |
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |

### User (JWT Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cashier/balances` | Get wallet balances |
| POST | `/cashier/deposit` | Deposit funds |
| POST | `/cashier/withdraw` | Withdraw funds |
| POST | `/dice/play` | Play dice game |
| POST | `/mines/start` | Start mines game |
| POST | `/mines/reveal` | Reveal a tile |
| POST | `/mines/cashout` | Cash out mines |
| POST | `/plinko/play` | Play plinko game |
| POST | `/olympus/spin` | Spin olympus slot |
| POST | `/crash/bet` | Place crash bet |
| POST | `/crash/cashout` | Cash out crash |

### Admin (JWT + ADMIN role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | GGR/NGR dashboard |
| GET | `/admin/dashboard/all-brands` | All brands overview |
| PUT | `/admin/house-edge/:siteId` | Update house edge |
| PUT | `/admin/risk-limits/:siteId` | Update risk limits |
| POST | `/admin/brands/create` | Create new brand |
| GET | `/admin/brands/list` | List all brands |
| DELETE | `/admin/brands/:siteId` | Deactivate brand |
| POST | `/admin/brands/clone` | Clone existing brand |
| GET | `/admin/fraud/alerts` | View fraud alerts |
| GET | `/admin/fraud/scan/:siteId` | Run fraud scan |
| PUT | `/admin/fraud/alerts/:id` | Update alert status |

### Headers
All endpoints accept:
- `Authorization: Bearer <JWT>` - Required for User/Admin endpoints
- `x-site-id: <siteId>` - Optional, auto-detected from domain

---

## Database

- **Type**: PostgreSQL (DigitalOcean Managed)
- **Host**: db-postgresql-ams3-84274-do-user-27684781-0.f.db.ondigitalocean.com
- **Port**: 25060
- **Database**: defaultdb
- **SSL**: Required

### Migrations
```bash
cd /var/www/stek/backend
npx prisma migrate dev --name "description"
npx prisma generate
npm run build
pm2 restart stek-backend
```

---

## Environment Variables

Located in `/var/www/stek/backend/.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - production/development
- `PORT` - Backend port (3000)
- `CORS_ORIGINS` - Allowed origins (dynamic from DB)
- `OPENAI_API_KEY` - ChatGPT integration

---

## Troubleshooting

### Backend won't start
```bash
cd /var/www/stek/backend
npm run build 2>&1 | grep error  # Check for build errors
pm2 logs stek-backend --lines 50  # Check runtime logs
```

### Database connection issues
```bash
npx prisma db pull  # Test DB connection
```

### Brand not showing
1. Check `SiteConfiguration.active = true`
2. Check domain matches exactly
3. Check nginx has server block for domain
4. Check DNS points to server IP

### High memory usage
```bash
pm2 monit  # Real-time monitoring
curl localhost:3000/system/health  # Check memory stats
```

---

## Sample Brand Configuration JSON

```json
{
  "brandName": "LuckyDragon",
  "domain": "luckydragon.com",
  "primaryColor": "#ff6600",
  "secondaryColor": "#1a1a2e",
  "accentColor": "#f59e0b",
  "logoUrl": "/assets/brands/site-luckydragon-abc123/logo.png",
  "faviconUrl": "/assets/brands/site-luckydragon-abc123/favicon.ico",
  "houseEdgeConfig": {
    "dice": 0.02,
    "crash": 0.04,
    "mines": 0.03,
    "plinko": 0.03,
    "olympus": 0.04
  },
  "riskLimits": {
    "maxPayoutPerDay": 50000,
    "maxPayoutPerBet": 10000,
    "maxBetAmount": 5000
  },
  "botConfig": {
    "enabled": true,
    "botCount": 50,
    "minBetAmount": 5,
    "maxBetAmount": 1000,
    "chatEnabled": true,
    "botNamePrefix": "LD_"
  }
}
```

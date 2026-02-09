# StakePro - Full Restore Guide

## What You Need

1. A fresh Ubuntu 22.04 server (DigitalOcean Droplet recommended)
2. SSH access as root
3. Your credentials (see below)

## Quick Restore (5 minutes)

### Step 1: Clone the repo
```bash
cd /var/www
git clone git@github.com:tradege/stek.git
cd stek
```

### Step 2: Create environment files

Copy the example files and fill in your real credentials:

```bash
cp deploy/.env.example .env
cp deploy/backend.env.example backend/.env
cp deploy/frontend.env.local.example frontend/.env.local
cp deploy/ecosystem.config.example.js ecosystem.config.js
```

Edit each file with your real values:
- DATABASE_URL (PostgreSQL connection string)
- JWT_SECRET
- INTEGRATION_API_KEY
- YOUR_SERVER_IP (the new server IP)

### Step 3: Run the restore script
```bash
chmod +x deploy/restore.sh
sudo ./deploy/restore.sh
```

### Step 4: Done!
Your site will be running at http://YOUR_SERVER_IP

## Credentials You Need to Remember

| Item | Where to Get |
|------|-------------|
| DATABASE_URL | DigitalOcean Managed Database panel |
| JWT_SECRET | Any secure random string (64+ chars) |
| INTEGRATION_API_KEY | Your API key for external game providers |
| Server IP | DigitalOcean Droplet panel |

## What is NOT in GitHub (by design)

| File | Reason | How to Restore |
|------|--------|---------------|
| .env | Contains secrets | Create from deploy/.env.example |
| backend/.env | Contains secrets | Create from deploy/backend.env.example |
| frontend/.env.local | Contains server IP | Create from deploy/frontend.env.local.example |
| ecosystem.config.js | Contains secrets | Create from deploy/ecosystem.config.example.js |
| node_modules/ | Auto-installed | npm install |
| .next/ | Auto-built | npm run build |
| dist/ | Auto-built | npm run build |

## What IS in GitHub (everything else)

- All source code (backend + frontend)
- Prisma schema + migrations (database structure auto-creates)
- Prisma seed files (initial data)
- Nginx configuration template
- PM2 ecosystem template
- This restore guide + restore script
- All test files

## Database

The database is on DigitalOcean Managed Database (separate from the server).
If the server dies, the database is safe. Just point the new server to the same database.

If you need to recreate the database:
```bash
cd /var/www/stek/backend
npx prisma migrate deploy  # Creates all tables
npx prisma db seed          # Seeds initial data
```

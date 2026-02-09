#!/bin/bash
set -e

echo "========================================"
echo "  StakePro - Full Restore Script"
echo "========================================"

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root (sudo)"
  exit 1
fi

PROJECT_DIR="/var/www/stek"

echo "[1/8] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq nginx nodejs npm git curl
npm install -g pm2 n
n 22
hash -r

echo "[2/8] Cloning repository..."
if [ ! -d "$PROJECT_DIR" ]; then
  mkdir -p /var/www
  cd /var/www
  git clone git@github.com:tradege/stek.git
fi
cd $PROJECT_DIR

echo "[3/8] Setting up environment files..."
if [ ! -f ".env" ]; then
  echo "ERROR: Create .env from deploy/.env.example with your real credentials"
  exit 1
fi
if [ ! -f "backend/.env" ]; then
  echo "ERROR: Create backend/.env from deploy/backend.env.example"
  exit 1
fi
if [ ! -f "frontend/.env.local" ]; then
  echo "ERROR: Create frontend/.env.local from deploy/frontend.env.local.example"
  exit 1
fi

echo "[4/8] Installing backend dependencies..."
cd $PROJECT_DIR/backend
npm install
npx prisma generate

echo "[5/8] Building backend..."
npm run build

echo "[6/8] Running database migrations..."
npx prisma migrate deploy
npx prisma db seed 2>/dev/null || echo "Seed already applied"

echo "[7/8] Installing and building frontend..."
cd $PROJECT_DIR/frontend
npm install
npm run build

echo "[8/8] Setting up Nginx and PM2..."
cd $PROJECT_DIR
if [ ! -f "ecosystem.config.js" ]; then
  echo "ERROR: Create ecosystem.config.js from deploy/ecosystem.config.example.js"
  exit 1
fi
cp deploy/nginx-stek.conf /etc/nginx/sites-available/stek
ln -sf /etc/nginx/sites-available/stek /etc/nginx/sites-enabled/stek
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "========================================"
echo "========================================"
pm2 status

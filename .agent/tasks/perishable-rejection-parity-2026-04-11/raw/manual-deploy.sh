set -eo pipefail
cd /var/www/wesetupru/data/www/wesetup.ru/app

echo "de508ea0518237bbc4ab6fc2fed14b8bc037f6ca" > .build-sha
date -u +%Y-%m-%dT%H:%M:%SZ > .build-time

tar xf deploy.tar
rm -f deploy.tar
[ -f .env.bak ] && cp .env.bak .env || true

[ -s ~/.nvm/nvm.sh ] && . ~/.nvm/nvm.sh || true

echo "=== npm ci ==="
npm ci 2>&1 | tail -5

echo "=== prisma generate ==="
npx prisma generate 2>&1 | tail -5

echo "=== prisma db push ==="
npx prisma db push 2>&1 | tail -5

echo "=== seed ==="
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
  npx tsx prisma/seed.ts 2>&1 | tail -20
else
  echo ".env not found, skip seed"
fi

echo "=== build ==="
npm run build 2>&1 | tail -20

echo "=== pm2 restart ==="
npx pm2 delete haccp-online 2>/dev/null || true
npx pm2 start npm --name haccp-online --cwd /var/www/wesetupru/data/www/wesetup.ru/app -- start 2>&1 | tail -5
npx pm2 status haccp-online --no-color

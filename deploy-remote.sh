set -e
APP=/var/www/wesetupru/data/www/wesetup.ru/app
cd "$APP"
rm -rf .next
rm -f .build-sha .build-time
tar -xf /tmp/codex-audit-plan-deploy.tar -C "$APP"
npm install
npx prisma generate
npx prisma db push
npm run build
printf '57f57e7\n' > .build-sha
date -u +%Y-%m-%dT%H:%M:%SZ > .build-time
pm2 restart haccp-online
npx tsx prisma/seed.ts
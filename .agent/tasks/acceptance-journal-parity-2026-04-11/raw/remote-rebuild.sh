set -eo pipefail

APP=/var/www/wesetupru/data/www/wesetup.ru/app
cd "$APP"

pkill -f "next build" 2>/dev/null || true
npx pm2 delete haccp-online 2>/dev/null || true
rm -rf .next
mkdir -p .next/static

[ -s ~/.nvm/nvm.sh ] && . ~/.nvm/nvm.sh || true

npx next build
npx pm2 start npm --name haccp-online --cwd "$APP" -- start

printf 'SHA='
cat .build-sha
printf '\nTIME='
cat .build-time
printf '\n'

pm2 status haccp-online --no-color
printf '\nHTTP\n'
curl -I -s http://127.0.0.1:3002 | sed -n '1,10p'

APP=/var/www/wesetupru/data/www/wesetup.ru/app
cd "$APP"
echo BUILD_SHA=$(cat .build-sha)
echo BUILD_TIME=$(cat .build-time)
pm2 status haccp-online --no-color
echo ---HTTP---
curl -I -s http://127.0.0.1:3002 | sed -n '1,10p'
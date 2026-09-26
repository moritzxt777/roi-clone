#!/bin/bash
cd /var/www/roi-clone
export NODE_OPTIONS='--max-old-space-size=1024'
echo "=== Starting build at $(date) ===" > /var/www/roi-clone/build.log
npm run build >> /var/www/roi-clone/build.log 2>&1
BUILD_STATUS=$?
echo "Build exited with status $BUILD_STATUS at $(date)" >> /var/www/roi-clone/build.log
if [ $BUILD_STATUS -eq 0 ]; then
  pm2 restart roi-clone --update-env >> /var/www/roi-clone/build.log 2>&1
  echo "PM2 restarted successfully" >> /var/www/roi-clone/build.log
else
  echo "Build failed, PM2 not restarted" >> /var/www/roi-clone/build.log
fi

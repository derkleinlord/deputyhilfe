#!/bin/bash
set -e

DEPLOY_DIR="/var/www/dh"

echo "Frontend wird aktualisiert..."
cd "$DEPLOY_DIR"
npm install
npm run build

echo "Backend wird aktualisiert..."
cd "$DEPLOY_DIR/server"
npm install
npm run build

echo "Backend wird neu gestartet..."
pm2 restart deputyhilfe

echo "Nginx wird neu geladen..."
systemctl reload nginx
cd "$DEPLOY_DIR"

echo "DeputyHilfe wurde erfolgreich aktualisiert."

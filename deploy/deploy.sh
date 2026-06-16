#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

VERSION=$(date +"%Y%m%d_%H%M%S")

ENV_FILE=${1:-"$SCRIPT_DIR/deploy.prod.env"}

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Env file not found: $ENV_FILE"
  exit 1
fi

echo "📦 Loading env: $ENV_FILE"

set -a
source "$ENV_FILE"
set +a

: "${SERVER:?SERVER is required}"
: "${PASSWORD:?PASSWORD is required}"
: "${REMOTE_DIR:?REMOTE_DIR is required}"

echo ""
echo "=================================="
echo "🚀 Deploy version: $VERSION"
echo "🎯 Target: $SERVER"
echo "📁 Remote: $REMOTE_DIR"
echo "=================================="
echo ""

echo "📤 Sync source..."

sshpass -p "$PASSWORD" rsync -az \
  -e "ssh -o StrictHostKeyChecking=no" \
  --delete \
  --exclude-from="$SCRIPT_DIR/.rsyncignore" \
  ./ \
  "${SERVER}:${REMOTE_DIR}/"

echo "🐳 Build & Deploy..."

sshpass -p "$PASSWORD" ssh \
  -o StrictHostKeyChecking=no \
  "${SERVER}" <<EOF

set -euo pipefail

cd ${REMOTE_DIR}

echo ""
echo "=============================="
echo "Deploy version: ${VERSION}"
echo "=============================="

#
# Backup current version
#
if [ -f current.version ]; then
  cp current.version previous.version
fi

#
# Build image
#
docker build \
  -t crm-server:${VERSION} \
  .

#
# Save current version
#
echo "${VERSION}" > current.version

#
# Save deploy history
#
echo "\$(date '+%Y-%m-%d %H:%M:%S') => ${VERSION}" >> deploy-history.log

#
# Deploy
#
VERSION=${VERSION} docker compose up -d --force-recreate

#
# Health check with retry
#
HEALTH_OK=false

for i in {1..12}; do
    if curl -fsS http://localhost:3000/health >/dev/null; then
        HEALTH_OK=true
        break
    fi

    echo "⏳ Waiting health check... (\$i/12)"
    sleep 5
done

#
# Rollback if health check failed
#
if [ "\$HEALTH_OK" != "true" ]; then

    echo ""
    echo "❌ Health check failed"

    if [ -f previous.version ]; then
        PREVIOUS=\$(cat previous.version)
        echo "⏪ Rollback to \$PREVIOUS"
        VERSION=\$PREVIOUS docker compose up -d --force-recreate
        sleep 10
        if curl -fsS http://localhost:3000/health >/dev/null; then
            echo "✅ Rollback successful"
        else
            echo "❌ Rollback failed"
        fi
    fi
    exit 1
fi

echo "✅ Health check passed"

#
# Cleanup old images (keep latest 10)
#
CURRENT=\$(cat current.version)
PREVIOUS=\$(cat previous.version 2>/dev/null || true)

docker images crm-server \
  --format '{{.Tag}}' \
  | sort -r \
  | tail -n +11 \
  | while read -r tag
do
    [ -z "\$tag" ] && continue
    [ "\$tag" = "\$CURRENT" ] && continue
    [ "\$tag" = "\$PREVIOUS" ] && continue

    echo "🗑 Remove image: \$tag"

    docker rmi crm-server:\$tag || true
done

echo "🧹 Cleanup completed"

EOF

echo ""
echo "=================================="
echo "✅ Deploy success"
echo "📦 Version: $VERSION"
echo "=================================="

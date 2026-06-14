#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

VERSION=$(date +"%Y%m%d_%H%M%S")

ENV_FILE=${1:-deploy.prod.env}

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
  --delete \
  --exclude-from='.rsyncignore' \
  ./ \
  "${SERVER}:${REMOTE_DIR}/"

echo "🐳 Build & Deploy..."

sshpass -p "$PASSWORD" ssh \
  -o StrictHostKeyChecking=no \
  "${SERVER}" << EOF

set -e

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
VERSION=${VERSION} docker compose up -d

#
# Wait startup
#
sleep 15

#
# Health check
#
if ! curl -fsS http://localhost:3000/health > /dev/null; then

  echo ""
  echo "❌ Health check failed"

  if [ -f previous.version ]; then

      PREVIOUS=\$(cat previous.version)

      echo "⏪ Rollback to \$PREVIOUS"

      VERSION=\$PREVIOUS docker compose up -d

      sleep 10

      if curl -fsS http://localhost:3000/health > /dev/null; then
          echo "✅ Rollback successful"
      else
          echo "❌ Rollback failed"
      fi

  fi

  exit 1
fi

echo "✅ Health check passed"

#
# Keep latest 10 versions
#
docker images crm-server \
  --format '{{.Tag}}' \
  | sort -r \
  | tail -n +11 \
  | while read tag
do
  [ -z "\$tag" ] && continue

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

#!/usr/bin/env bash

set -euo pipefail

ENV_FILE=${1:-deploy.prod.env}

if [ ! -f "$ENV_FILE" ]; then
echo "❌ Env file not found: $ENV_FILE"
exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${SERVER:?SERVER is required}"
: "${PASSWORD:?PASSWORD is required}"

CONTAINER_NAME=${CONTAINER_NAME:-mongo1}
SOURCE_DB=${SOURCE_DB:-crm}
TARGET_DB=${TARGET_DB:-crm_vps}

BACKUP_DIR="./backup/mongodb"

mkdir -p "$BACKUP_DIR"

echo "🔍 Finding latest MongoDB backup on server..."

LATEST_FILE=$(
  sshpass -p "$PASSWORD" ssh \
    -o StrictHostKeyChecking=no \
    "$SERVER" \
    "ls -t /root/backup/mongodb/*.gz | head -n 1"
)

if [ -z "$LATEST_FILE" ]; then
echo "❌ No backup file found on server"
exit 1
fi

FILENAME=$(basename "$LATEST_FILE")
LOCAL_FILE="$BACKUP_DIR/$FILENAME"

echo "📦 Latest backup: $FILENAME"

if [ -f "$LOCAL_FILE" ]; then
echo "ℹ️ Backup already exists locally:"
echo "   $LOCAL_FILE"
else
echo "⬇️ Downloading backup..."

sshpass -p "$PASSWORD" scp \
  -o StrictHostKeyChecking=no \
  "$SERVER:$LATEST_FILE" \
  "$LOCAL_FILE"

echo "✅ Download completed"
fi

echo ""
echo "========================================="
echo "Mongo Restore Configuration"
echo "========================================="
echo "Backup File : $LOCAL_FILE"
echo "Container   : $CONTAINER_NAME"
echo "Source DB   : $SOURCE_DB"
echo "Target DB   : $TARGET_DB"
echo "========================================="
echo ""

read -r -p "⚠️ Restore backup to '$TARGET_DB'? (y/N): " CONFIRM

if [[ ! "$CONFIRM" =~ ^([yY]|yes|YES)$ ]]; then
echo "❌ Restore cancelled"
exit 0
fi

echo ""
echo "🔍 Checking container..."

docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$" || {
echo "❌ Container not found: $CONTAINER_NAME"
exit 1
}

echo "📤 Copying backup to container..."

docker cp \
  "$LOCAL_FILE" \
  "$CONTAINER_NAME:/tmp/backup.gz"

echo "🗑️ Dropping database: $TARGET_DB"

docker exec "$CONTAINER_NAME" mongosh \
  --quiet \
  "$TARGET_DB" \
  --eval "db.dropDatabase()"

echo "♻️ Restoring backup..."

docker exec "$CONTAINER_NAME" mongorestore \
--gzip \
--archive=/tmp/backup.gz \
--nsFrom="${SOURCE_DB}.*" \
--nsTo="${TARGET_DB}.*"

echo ""
echo "✅ Restore completed successfully"
echo "📦 Backup : $FILENAME"
echo "🗄️ Database : $TARGET_DB"
echo ""

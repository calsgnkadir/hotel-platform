#!/usr/bin/env bash
# Disposable real-MySQL verification. Requires Docker Compose, Bash and gzip.
# Does not load .env.prod, publish ports or access an existing Compose project.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
mkdir -p "$ROOT/hotelapp/target"
RUN="$(mktemp -d "$ROOT/hotelapp/target/backup-drill-XXXXXX")"
PROJECT="kadrom-backup-drill-$(date +%s)-$$"
COMPOSE="$RUN/compose.yml"
export MYSQL_ROOT_PASSWORD='disposable-backup-drill-only'
cat > "$COMPOSE" <<EOF
name: $PROJECT
services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: hotel_platform
      MYSQL_ROOT_PASSWORD: disposable-backup-drill-only
    tmpfs:
      - /var/lib/mysql
EOF
dc() { docker compose -f "$COMPOSE" "$@"; }
sql() { dc exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -B hotel_platform; }
cleanup() { dc down --remove-orphans >/dev/null; }
trap cleanup EXIT
export KADROM_COMPOSE_FILE="$COMPOSE" KADROM_ENV_FILE="$RUN/empty.env"
printf '# Deliberately empty; never load production secrets.\n' > "$KADROM_ENV_FILE"
export BACKUP_DIR="$RUN/backups with spaces" KEEP=2
dc up -d
READY=false
for ATTEMPT in $(seq 1 60); do
  if printf 'SELECT 1;' | sql >/dev/null 2>&1; then READY=true; break; fi
  sleep 1
done
[ "$READY" = true ] || { echo 'MySQL did not become ready' >&2; exit 1; }
printf "CREATE TABLE outbox_events (id BIGINT PRIMARY KEY, payload TEXT NOT NULL); INSERT INTO outbox_events VALUES (1, '{\"to\":\"legacy@example.test\",\"subject\":\"Legacy\",\"html\":\"old\"}');\n" | sql
sql < "$ROOT/hotelapp/src/main/resources/db/migration/V30__outbox_email_attachments.sql"
printf "INSERT INTO outbox_events VALUES (2, JSON_OBJECT('to','attachment@example.test','attachment',JSON_OBJECT('content',REPEAT('A',95000)))); CREATE TABLE restore_probe (id INT PRIMARY KEY, value TEXT); INSERT INTO restore_probe WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i+1 FROM n WHERE i<100) SELECT i, HEX(RANDOM_BYTES(1024)) FROM n;\n" | sql
CHECK="$(printf "SELECT DATA_TYPE FROM information_schema.columns WHERE TABLE_SCHEMA='hotel_platform' AND TABLE_NAME='outbox_events' AND COLUMN_NAME='payload'; SELECT COUNT(*),MAX(OCTET_LENGTH(payload)) FROM outbox_events; SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.subject')) FROM outbox_events WHERE id=1;" | sql)"
[[ "$CHECK" == *mediumtext* && "$CHECK" == *Legacy* ]] || exit 1
[ "$(printf "SELECT LENGTH(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.attachment.content'))) FROM outbox_events WHERE id=2;" | sql)" = 95000 ]
echo 'PASS V30: legacy EMAIL preserved and 95,000-byte attachment content persisted in MEDIUMTEXT'
FINGERPRINT="SET SESSION group_concat_max_len=100000; SELECT SHA2(GROUP_CONCAT(SHA2(value,256) ORDER BY id),256) FROM restore_probe;"
EXPECTED="$(printf '%s' "$FINGERPRINT" | sql)"
bash "$ROOT/deploy/prod/backup.sh"
FIRST="$(find "$BACKUP_DIR" -name '*.sql.gz' -type f | head -1)"
printf "UPDATE restore_probe SET value='changed'; DELETE FROM outbox_events;\n" | sql
printf 'yes\n' | bash "$ROOT/deploy/prod/restore.sh" "$FIRST"
[ "$(printf '%s' "$FINGERPRINT" | sql)" = "$EXPECTED" ]
[ "$(printf 'SELECT COUNT(*) FROM outbox_events;' | sql)" = 2 ]
echo 'PASS restore: original 100-row checksum and both outbox rows recovered'
head -c 40 "$FIRST" > "$RUN/truncated.sql.gz"
if printf 'yes\n' | bash "$ROOT/deploy/prod/restore.sh" "$RUN/truncated.sql.gz"; then echo 'Corrupt archive accepted' >&2; exit 1; fi
[ "$(printf '%s' "$FINGERPRINT" | sql)" = "$EXPECTED" ]
echo 'PASS corrupt restore: archive rejected before SQL; database checksum unchanged'
if MYSQL_ROOT_PASSWORD=wrong-password bash "$ROOT/deploy/prod/backup.sh"; then echo 'Failed dump accepted' >&2; exit 1; fi
[ "$(find "$BACKUP_DIR" -type f -name '*.sql.gz' | wc -l)" -eq 1 ]
[ "$(find "$BACKUP_DIR" -type f -name '*.part' | wc -l)" -eq 0 ]
echo 'PASS failed dump: no final archive or leftover partial file'
sleep 1
bash "$ROOT/deploy/prod/backup.sh"
sleep 1
bash "$ROOT/deploy/prod/backup.sh"
[ "$(find "$BACKUP_DIR" -type f -name '*.sql.gz' | wc -l)" -eq 2 ]
[ ! -e "$FIRST" ]
echo 'PASS rotation: newest two retained in directory containing spaces'
echo "Evidence directory: $RUN"

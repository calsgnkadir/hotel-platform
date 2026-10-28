#!/usr/bin/env bash
# Offline scheduler/remote-failure regression. No database, remote or real notification is used.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
mkdir -p "$ROOT/hotelapp/target"
RUN="$(mktemp -d "$ROOT/hotelapp/target/backup-job-XXXXXX")"
mkdir -p "$RUN/bin"
export RUN BACKUP_DIR="$RUN/backups with spaces" KEEP=14 MYSQL_ROOT_PASSWORD=offline-placeholder
export KADROM_ENV_FILE="$RUN/empty.env" KADROM_COMPOSE_FILE="$RUN/not-used.yml"
printf '# Never load production credentials.\n' > "$KADROM_ENV_FILE"
head -c 16384 /dev/urandom | base64 > "$RUN/dump.sql"
cat > "$RUN/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${DUMP_FAIL:-false}" = true ]; then printf 'partial'; exit 42; fi
cat "$RUN/dump.sql"
EOF
cat > "$RUN/bin/rclone" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'called\n' >> "$RUN/remote-calls"
[ "${REMOTE_FAIL:-false}" = false ] || exit 43
[ "$1" = copyto ] && [ "$2" = --checksum ] && [ "$3" = -- ]
cp -- "$4" "$RUN/remote-copy.sql.gz"
EOF
cat > "$RUN/bin/notify" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$1" >> "$RUN/notices"
EOF
chmod +x "$RUN/bin/docker" "$RUN/bin/rclone" "$RUN/bin/notify"
export PATH="$RUN/bin:$PATH" BACKUP_FAILURE_HOOK="$RUN/bin/notify"
unset BACKUP_REMOTE
bash -n "$ROOT/deploy/prod/run-backup.sh"
bash "$ROOT/deploy/prod/run-backup.sh"
grep -qx 'status=LOCAL_ONLY' "$BACKUP_DIR/.backup-status"
[ ! -e "$RUN/remote-calls" ] && [ ! -e "$RUN/notices" ]
echo 'PASS disabled remote: local-only status and no external copy/notification'
if DUMP_FAIL=true bash "$ROOT/deploy/prod/run-backup.sh"; then exit 1; fi
grep -qx 'status=LOCAL_BACKUP_FAILED' "$BACKUP_DIR/.backup-status"
grep -qx 'LOCAL_BACKUP_FAILED' "$RUN/notices"
[ "$(find "$BACKUP_DIR" -name '*.sql.gz' -type f | wc -l)" -eq 1 ]
[ ! -d "$BACKUP_DIR/.scheduled-backup.lock" ]
echo 'PASS failed dump: failure state/hook, previous valid archive retained, lock released'
export BACKUP_REMOTE='test-remote:bucket/folder with spaces'
if REMOTE_FAIL=true bash "$ROOT/deploy/prod/run-backup.sh"; then exit 1; fi
grep -qx 'status=REMOTE_COPY_FAILED' "$BACKUP_DIR/.backup-status"
grep -qx 'REMOTE_COPY_FAILED' "$RUN/notices"
[ "$(find "$BACKUP_DIR" -name '*.sql.gz' -type f | wc -l)" -eq 2 ]
echo 'PASS failed remote: local archive retained, job fails and failure hook called'
bash "$ROOT/deploy/prod/run-backup.sh"
grep -qx 'status=REMOTE_COPY_ACCEPTED' "$BACKUP_DIR/.backup-status"
gzip -dc "$RUN/remote-copy.sql.gz" | cmp "$RUN/dump.sql" -
echo 'PASS copy accepted: remote mock contains identical complete dump'
export BACKUP_REMOTE="$RUN/not-a-remote"
CALLS="$(wc -l < "$RUN/remote-calls")"
if bash "$ROOT/deploy/prod/run-backup.sh"; then exit 1; fi
grep -qx 'status=REMOTE_CONFIG_INVALID' "$BACKUP_DIR/.backup-status"
[ "$(wc -l < "$RUN/remote-calls")" -eq "$CALLS" ]
echo 'PASS local destination rejected without invoking remote tool'
mkdir "$BACKUP_DIR/.scheduled-backup.lock"
set +e
bash "$ROOT/deploy/prod/run-backup.sh"
CODE=$?
set -e
[ "$CODE" -eq 75 ]
grep -qx 'LOCK_UNAVAILABLE' "$RUN/notices"
rmdir "$BACKUP_DIR/.scheduled-backup.lock"
echo 'PASS overlapping run rejected and failure hook notified'
cat > "$RUN/bin/mv" <<'EOF'
#!/usr/bin/env bash
exit 44
EOF
chmod +x "$RUN/bin/mv"
if bash "$ROOT/deploy/prod/run-backup.sh"; then exit 1; fi
grep -qx 'STATE_WRITE_FAILED' "$RUN/notices"
[ ! -d "$BACKUP_DIR/.scheduled-backup.lock" ]
echo 'PASS status write failure: hook still invoked and lock released'
echo "Evidence directory: $RUN"

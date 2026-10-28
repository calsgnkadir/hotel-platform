#!/usr/bin/env bash
# Offline shell safety checks with a fake Docker CLI. Not a MySQL restore drill.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
mkdir -p "$ROOT/hotelapp/target"
RUN="$(mktemp -d "$ROOT/hotelapp/target/backup-safety-XXXXXX")"
mkdir -p "$RUN/bin"
export RUN
cat > "$RUN/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case " $* " in
  *' mysqldump '*)
    if [ "${DUMP_FAIL:-false}" = true ]; then printf 'partial dump'; exit 42; fi
    cat "$RUN/dump.sql"
    ;;
  *' mysql '*) cat > "$RUN/imported.sql" ;;
  *) echo 'Unexpected Docker invocation' >&2; exit 43 ;;
esac
EOF
chmod +x "$RUN/bin/docker"
export PATH="$RUN/bin:$PATH" MYSQL_ROOT_PASSWORD=offline-placeholder
export KADROM_ENV_FILE="$RUN/empty.env" KADROM_COMPOSE_FILE="$RUN/unused-compose.yml"
printf '# no real credentials\n' > "$KADROM_ENV_FILE"
export BACKUP_DIR="$RUN/backups with spaces" KEEP=2
{ printf '%s\n' '-- artificial random dump data'; head -c 16384 /dev/urandom | base64; } > "$RUN/dump.sql"
for SCRIPT in backup.sh restore.sh tests/backup-restore-drill.sh tests/backup-safety-test.sh; do bash -n "$ROOT/deploy/prod/$SCRIPT"; done
bash "$ROOT/deploy/prod/backup.sh"
FIRST="$(find "$BACKUP_DIR" -type f -name '*.sql.gz' | head -1)"
if DUMP_FAIL=true bash "$ROOT/deploy/prod/backup.sh"; then echo 'failed dump accepted' >&2; exit 1; fi
[ "$(find "$BACKUP_DIR" -type f -name '*.sql.gz' | wc -l)" -eq 1 ]
[ "$(find "$BACKUP_DIR" -type f -name '*.part' | wc -l)" -eq 0 ]
echo 'PASS pipeline failure: no final archive or leftover partial file'
head -c 40 "$FIRST" > "$RUN/broken.sql.gz"
if printf 'yes\n' | bash "$ROOT/deploy/prod/restore.sh" "$RUN/broken.sql.gz"; then echo 'broken archive accepted' >&2; exit 1; fi
[ ! -e "$RUN/imported.sql" ]
echo 'PASS corrupt archive: Docker import never invoked'
if printf 'no\n' | bash "$ROOT/deploy/prod/restore.sh" "$FIRST"; then echo 'cancel accepted' >&2; exit 1; fi
[ ! -e "$RUN/imported.sql" ]
printf 'yes\n' | bash "$ROOT/deploy/prod/restore.sh" "$FIRST"
cmp "$RUN/dump.sql" "$RUN/imported.sql"
echo 'PASS confirmation: cancel skips import; yes supplies complete decompressed bytes'
sleep 1
bash "$ROOT/deploy/prod/backup.sh"
sleep 1
bash "$ROOT/deploy/prod/backup.sh"
[ "$(find "$BACKUP_DIR" -type f -name '*.sql.gz' | wc -l)" -eq 2 ]
[ ! -e "$FIRST" ]
if KEEP=0 bash "$ROOT/deploy/prod/backup.sh"; then echo 'invalid KEEP accepted' >&2; exit 1; fi
echo 'PASS rotation and KEEP validation with paths containing spaces'
echo "Evidence directory: $RUN"

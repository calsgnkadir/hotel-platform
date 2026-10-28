#!/usr/bin/env bash
# Scheduled backup: local dump, optional remote copy, private state and optional failure hook.
# Does not install cron jobs or configure any external service.
set -euo pipefail
umask 077
cd "$(dirname "$0")"
ENV_FILE="${KADROM_ENV_FILE:-.env.prod}"
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
export BACKUP_DIR="${BACKUP_DIR:-./backups}"
notify_failure() {
  if [ -n "${BACKUP_FAILURE_HOOK:-}" ]; then
    if [ -x "$BACKUP_FAILURE_HOOK" ]; then
      "$BACKUP_FAILURE_HOOK" "$1" || echo '[backup-job] Failure hook also failed.' >&2
    else
      echo '[backup-job] Failure hook is not executable.' >&2
    fi
  fi
}
if ! mkdir -p "$BACKUP_DIR"; then notify_failure BACKUP_DIRECTORY_FAILED; exit 1; fi
LOCK="$BACKUP_DIR/.scheduled-backup.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo '[backup-job] Another run or a stale lock exists; inspect the lock before removing it.' >&2
  notify_failure LOCK_UNAVAILABLE
  exit 75
fi
RESULT="$LOCK/result"
STATE="$BACKUP_DIR/.backup-status"
cleanup() { rm -f -- "$RESULT" "$LOCK/status"; rmdir -- "$LOCK"; }
trap cleanup EXIT
state() {
  printf 'time_utc=%s\nstatus=%s\n' "$(date -u +%FT%TZ)" "$1" > "$LOCK/status" || return 1
  mv -- "$LOCK/status" "$STATE"
}
fail() {
  state "$1" || echo '[backup-job] Status could not be persisted.' >&2
  echo "[backup-job] $1; inspect private backup logs." >&2
  # An executable file, not a shell expression; credentials belong in its protected config.
  notify_failure "$1"
  exit 1
}
state RUNNING || fail STATE_WRITE_FAILED
if ! BACKUP_RESULT_FILE="$RESULT" bash ./backup.sh; then fail LOCAL_BACKUP_FAILED; fi
IFS= read -r ARCHIVE < "$RESULT" || fail LOCAL_RESULT_MISSING
[ -f "$ARCHIVE" ] || fail LOCAL_RESULT_MISSING
if [ -z "${BACKUP_REMOTE:-}" ]; then
  state LOCAL_ONLY || fail STATE_WRITE_FAILED
  echo '[backup-job] Local backup complete; remote copy is DISABLED.'
  exit 0
fi
# Require an rclone remote name; a local path must not be advertised as an external copy.
[[ "$BACKUP_REMOTE" =~ ^[A-Za-z0-9_-]+:.+ ]] || fail REMOTE_CONFIG_INVALID
command -v rclone >/dev/null 2>&1 || fail RCLONE_MISSING
if ! rclone copyto --checksum -- "$ARCHIVE" "${BACKUP_REMOTE%/}/${ARCHIVE##*/}"; then
  fail REMOTE_COPY_FAILED
fi
state REMOTE_COPY_ACCEPTED || fail STATE_WRITE_FAILED
echo '[backup-job] Remote copy accepted by rclone; physical location and restore must be verified separately.'

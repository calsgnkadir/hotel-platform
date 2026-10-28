#!/usr/bin/env bash
# Kadrom — prod MySQL yedekleme (docker-compose / VPS).
#
# Ne yapar: calisan mysql container'indan hotel_platform veritabanini
# --single-transaction ile (InnoDB tutarli, kilit yok) mysqldump'lar, gzip'ler,
# zaman damgali dosyaya yazar ve son KEEP kadarini tutup eskileri siler.
#
# Kullanim:
#   deploy/prod dizininden:  ./backup.sh
#   Zamanlanmis calistirma/dis kopya/hata uyarisi: run-backup.sh ve docs/BACKUP_READINESS.md
#
# Env (opsiyonel): BACKUP_DIR (varsayilan ./backups), KEEP (varsayilan 14)
# MYSQL_ROOT_PASSWORD .env.prod'tan okunur (compose ile ayni kaynak).
set -euo pipefail
umask 077

cd "$(dirname "$0")"                       # deploy/prod
COMPOSE_FILE="${KADROM_COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${KADROM_ENV_FILE:-.env.prod}"
DB_NAME="hotel_platform"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-14}"                         # son 14 yedegi tut

# MYSQL_ROOT_PASSWORD'u .env.prod'tan al (varsa) — compose ile ayni deger
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD gerekli (.env.prod icinde ya da ortam degiskeni olarak)}"
[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || { echo "[backup] KEEP pozitif tamsayi olmali" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
PART="$(mktemp "$BACKUP_DIR/.${DB_NAME}-${TS}-XXXXXX.sql.gz.part")"
NAME="${PART##*/}"
OUT="$BACKUP_DIR/${NAME#.}"
OUT="${OUT%.part}"
trap 'rm -f -- "$PART"' EXIT

echo "[backup $(date '+%F %T')] $DB_NAME -> $OUT"
docker compose -f "$COMPOSE_FILE" exec -T mysql \
  mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction --quick --routines --triggers --events \
    "$DB_NAME" | gzip -c > "$PART"
gzip -t -- "$PART"

# Bos/bozuk dump kontrolu (en az 1 KB olmali)
SIZE="$(stat -c%s "$PART" 2>/dev/null || stat -f%z "$PART" 2>/dev/null || echo 0)"
if [ ! -s "$PART" ] || [ "$SIZE" -lt 1024 ]; then
  echo "[backup] HATA: dump bos/cok kucuk ($SIZE bayt), siliniyor" >&2
  exit 1
fi
mv -- "$PART" "$OUT"

# Rotasyon: en yeni KEEP disindakileri sil
mapfile -d '' -t BACKUPS < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "$DB_NAME-*.sql.gz" -printf '%T@ %f\0' | sort -znr)
for INDEX in "${!BACKUPS[@]}"; do BACKUPS[$INDEX]="${BACKUPS[$INDEX]#* }"; done
if [ "${#BACKUPS[@]}" -gt "$KEEP" ]; then
  for OLD in "${BACKUPS[@]:KEEP}"; do rm -f -- "$BACKUP_DIR/$OLD"; done
fi

echo "[backup] tamam (${SIZE} bayt). Mevcut yedekler:"
for FILE in "${BACKUPS[@]:0:KEEP}"; do printf '  %s\n' "$BACKUP_DIR/$FILE"; done

# Optional private hand-off for the scheduler wrapper; never parse human log output.
if [ -n "${BACKUP_RESULT_FILE:-}" ]; then printf '%s\n' "$OUT" > "$BACKUP_RESULT_FILE"; fi

# ONEMLI: Bu dosyalar SUNUCUDA duruyor — disk olursen yedek de gider.
# En az bir kopyayi baska yere al (rclone/scp ile S3, B2, baska sunucu).
# Ornek (rclone yapilandirdiysan):
#   rclone copy "$OUT" remote:kadrom-backups/

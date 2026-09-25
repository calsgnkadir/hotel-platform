#!/usr/bin/env bash
# Kadrom — prod MySQL yedekleme (docker-compose / VPS).
#
# Ne yapar: calisan mysql container'indan hotel_platform veritabanini
# --single-transaction ile (InnoDB tutarli, kilit yok) mysqldump'lar, gzip'ler,
# zaman damgali dosyaya yazar ve son KEEP kadarini tutup eskileri siler.
#
# Kullanim:
#   deploy/prod dizininden:  ./backup.sh
#   cron (her gece 03:30):   30 3 * * *  cd /opt/kadrom/deploy/prod && ./backup.sh >> backups/backup.log 2>&1
#
# Env (opsiyonel): BACKUP_DIR (varsayilan ./backups), KEEP (varsayilan 14)
# DB_PASSWORD .env.prod'tan okunur (compose ile ayni kaynak).
set -euo pipefail

cd "$(dirname "$0")"                       # deploy/prod
COMPOSE_FILE="docker-compose.prod.yml"
DB_NAME="hotel_platform"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-14}"                         # son 14 yedegi tut

# DB_PASSWORD'u .env.prod'tan al (varsa) — compose ile ayni deger
if [ -f .env.prod ]; then set -a; . ./.env.prod; set +a; fi
: "${DB_PASSWORD:?DB_PASSWORD gerekli (.env.prod icinde ya da ortam degiskeni olarak)}"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/${DB_NAME}-${TS}.sql.gz"

echo "[backup $(date '+%F %T')] $DB_NAME -> $OUT"
docker compose -f "$COMPOSE_FILE" exec -T mysql \
  mysqldump -uroot -p"$DB_PASSWORD" \
    --single-transaction --quick --routines --triggers --events \
    "$DB_NAME" | gzip -c > "$OUT"

# Bos/bozuk dump kontrolu (en az 1 KB olmali)
SIZE="$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT" 2>/dev/null || echo 0)"
if [ ! -s "$OUT" ] || [ "$SIZE" -lt 1024 ]; then
  echo "[backup] HATA: dump bos/cok kucuk ($SIZE bayt), siliniyor" >&2
  rm -f "$OUT"
  exit 1
fi

# Rotasyon: en yeni KEEP disindakileri sil
ls -1t "$BACKUP_DIR"/${DB_NAME}-*.sql.gz 2>/dev/null | tail -n +"$((KEEP+1))" | xargs -r rm -f

echo "[backup] tamam (${SIZE} bayt). Mevcut yedekler:"
ls -1t "$BACKUP_DIR"/${DB_NAME}-*.sql.gz | head -n "$KEEP"

# ONEMLI: Bu dosyalar SUNUCUDA duruyor — disk olursen yedek de gider.
# En az bir kopyayi baska yere al (rclone/scp ile S3, B2, baska sunucu).
# Ornek (rclone yapilandirdiysan):
#   rclone copy "$OUT" remote:kadrom-backups/

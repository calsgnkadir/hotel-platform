#!/usr/bin/env bash
# AjansHotel — prod MySQL geri yukleme (docker-compose / VPS).
# DIKKAT: hotel_platform veritabaninin ustune yazar. Once mevcut durumun yedegini al.
#
# Kullanim:  ./restore.sh backups/hotel_platform-YYYYMMDD-HHMMSS.sql.gz
set -euo pipefail

cd "$(dirname "$0")"                       # deploy/prod
COMPOSE_FILE="docker-compose.prod.yml"
DB_NAME="hotel_platform"
FILE="${1:?Kullanim: ./restore.sh <yedek.sql.gz>}"
[ -f "$FILE" ] || { echo "Dosya yok: $FILE" >&2; exit 1; }

if [ -f .env.prod ]; then set -a; . ./.env.prod; set +a; fi
: "${DB_PASSWORD:?DB_PASSWORD gerekli (.env.prod ya da env)}"

echo "DIKKAT: '$DB_NAME' veritabaninin USTUNE '$FILE' yuklenecek."
read -r -p "Devam etmek icin 'yes' yaz: " ans
[ "$ans" = "yes" ] || { echo "iptal edildi."; exit 1; }

gunzip -c "$FILE" | docker compose -f "$COMPOSE_FILE" exec -T mysql \
  mysql -uroot -p"$DB_PASSWORD" "$DB_NAME"

echo "[restore] tamam — backend'i yeniden baslatmak isteyebilirsin:"
echo "  docker compose -f $COMPOSE_FILE restart backend"

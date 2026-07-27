#!/usr/bin/env bash
#
# IT Destek masaüstü uygulaması — güncelleme aynası.
#
# Public GitHub Release'lerinden son sürümün kurulum dosyalarını indirip
# nginx'in servis ettiği dizine (/home/user_esta/it-destek-updates/) atomik
# olarak yerleştirir. electron-updater bu dizindeki latest.yml'i okur.
#
# GitHub'a hiçbir sunucu sırrı verilmez — repo public olduğu için token gerekmez
# ve akış tek yönlüdür (sunucu çeker, GitHub sunucuya bağlanmaz).
#
# Kurulum (sunucuda, bir kez):
#   crontab -e  →  */5 * * * * /home/user_esta/it-destek-updates/pull.sh >> /home/user_esta/it-destek-updates/pull.log 2>&1
#
set -euo pipefail

REPO="maskofcrow/ticket_system"
DEST="/home/user_esta/it-destek-updates"
STAMP="$DEST/.surum"
API="https://api.github.com/repos/$REPO/releases/latest"

mkdir -p "$DEST"

# Son yayının tüm meta verisi (etiket + asset adresleri).
if ! JSON="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$API")"; then
  echo "$(date -Is) GitHub API'ye erişilemedi, atlanıyor"
  exit 0
fi

TAG="$(printf '%s' "$JSON" | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"
if [ -z "$TAG" ]; then
  echo "$(date -Is) tag_name okunamadı, atlanıyor"
  exit 0
fi

# Sürüm değişmediyse iş yok.
if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$TAG" ]; then
  exit 0
fi

echo "$(date -Is) yeni sürüm bulundu: $TAG — indiriliyor"

# Yalnızca güncelleme için gereken asset türleri.
URLS="$(printf '%s' "$JSON" \
  | grep -oE '"browser_download_url": *"[^"]+"' \
  | sed -E 's/.*"browser_download_url": *"([^"]+)".*/\1/' \
  | grep -E '\.(yml|exe|blockmap|dmg|zip)$' || true)"

if [ -z "$URLS" ]; then
  echo "$(date -Is) uygun asset bulunamadı, atlanıyor"
  exit 0
fi

# Yarım dosya servis edilmesin: geçici dizine indir, sonra atomik taşı.
TMP="$(mktemp -d "$DEST/.tmp.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

n=0
while IFS= read -r url; do
  [ -n "$url" ] || continue
  fn="$(basename "$url")"
  if curl -fsSL "$url" -o "$TMP/$fn"; then
    n=$((n + 1))
  else
    echo "$(date -Is) indirilemedi: $url — bu tur iptal"
    exit 0
  fi
done <<< "$URLS"

# Aynı dosya sisteminde mv atomik; her dosyayı yerine koy.
mv -f "$TMP"/* "$DEST"/
printf '%s' "$TAG" > "$STAMP"
echo "$(date -Is) tamam: $TAG ($n dosya yerleştirildi)"

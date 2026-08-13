#!/usr/bin/env bash
#
# Masaüstü uygulamaları — güncelleme aynası (hem IT Destek client'i hem crmadmin).
#
# Public GitHub Release'lerinden, HER uygulamanın (etiket ön ekine göre) en yeni
# sürümünün kurulum dosyalarını indirip nginx'in servis ettiği dizine atomik
# yerleştirir. electron-updater kendi feed'ini okur:
#   - IT Destek (desktop-v*)  → latest.yml     + it-destek-kurulum-*.exe
#   - crmadmin  (crmadmin-v*)  → crmadmin.yml   + esta-uzak-yonetim-kurulum-*.exe
# Dosya adları farklı olduğundan aynı dizinde çakışmadan bir arada dururlar.
#
# GitHub'a hiçbir sunucu sırrı verilmez (repo public, tek yönlü çekiş).
#
# Cron: */5 * * * * /home/user_esta/it-destek-updates/pull.sh >> .../pull.log 2>&1
#
set -euo pipefail

REPO="maskofcrow/ticket_system"
DEST="/home/user_esta/it-destek-updates"
mkdir -p "$DEST"

if ! JSON="$(curl -fsSL -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$REPO/releases?per_page=50")"; then
  echo "$(date -Is) GitHub API erişilemedi, atlanıyor"
  exit 0
fi

# Bir uygulamanın en yeni (draft/prerelease olmayan, ön ekli) sürümünü çeker.
cek() {
  local prefix="$1"
  local stamp="$DEST/.surum-$prefix"

  local out
  out="$(printf '%s' "$JSON" | python3 -c "
import sys, json
p = sys.argv[1]
for r in json.load(sys.stdin):
    if r.get('draft') or r.get('prerelease'):
        continue
    if not r.get('tag_name', '').startswith(p):
        continue
    print(r['tag_name'])
    for a in r.get('assets', []):
        u = a.get('browser_download_url', '')
        if u.endswith(('.yml', '.exe', '.blockmap', '.dmg', '.zip')):
            print(u)
    break
" "$prefix")" || return 0

  [ -z "$out" ] && return 0
  local tag; tag="$(printf '%s' "$out" | head -1)"
  if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$tag" ]; then
    return 0
  fi

  echo "$(date -Is) [$prefix] yeni sürüm: $tag — indiriliyor"
  local tmp; tmp="$(mktemp -d "$DEST/.tmp.XXXXXX")"
  local ok=1
  while IFS= read -r url; do
    [ -n "$url" ] || continue
    if ! curl -fsSL "$url" -o "$tmp/$(basename "$url")"; then
      echo "$(date -Is) [$prefix] indirilemedi: $url — bu tur iptal"
      ok=0
      break
    fi
  done <<< "$(printf '%s' "$out" | tail -n +2)"

  if [ "$ok" = 1 ] && [ -n "$(ls -A "$tmp" 2>/dev/null)" ]; then
    mv -f "$tmp"/* "$DEST"/
    printf '%s' "$tag" > "$stamp"
    echo "$(date -Is) [$prefix] tamam: $tag"
  fi
  rm -rf "$tmp"
}

cek "desktop-v"
cek "crmadmin-v"

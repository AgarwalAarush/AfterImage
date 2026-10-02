#!/bin/bash
# Explicit administrator step for the isolated bridge. No credential or DB leaves macserver.
set -euo pipefail
umask 077
STAGE=${1:?Pass the absolute staged release directory}
MODE=${2:---install}
CODE=/Users/Shared/AfterImageService/code
PRIVATE=/Users/Shared/AfterImageService/private
LABEL=dev.aarushagarwal.afterimage-storage-isolated
FILES=(scripts/storage-server.ts src/lib/assistant-storage.ts src/lib/assistant-model.ts src/lib/macserver-client.ts scripts/check-assistant-release.ts)
[[ "$(hostname -s)" == macserver && "$(id -u)" == 0 ]] || { echo 'Run as administrator on macserver.' >&2; exit 1; }
[[ "$STAGE" == /* && -d "$CODE" && -f "$PRIVATE/afterimage.sqlite" ]] || exit 1
[[ "$MODE" == --install || "$MODE" == --verify ]] || exit 1
cd "$CODE"
run() { /usr/bin/sudo -u _afterimage /usr/local/bin/node "$@"; }
backup() { run scripts/backup-sqlite.mjs "$PRIVATE/afterimage.sqlite" "$PRIVATE/backups" | /usr/local/bin/node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>console.log(JSON.parse(s).path))'; }
if [[ "$MODE" == --install ]]; then
  for file in "${FILES[@]}"; do [[ -f "$STAGE/$file" && ! -L "$STAGE/$file" ]] || exit 1; done
  /usr/bin/shasum -a 256 --check "$STAGE/release.sha256"
  RELEASE="$PRIVATE/assistant-release-$(date -u +%Y%m%dT%H%M%SZ)"
  /bin/mkdir -m 700 "$RELEASE"
  # Keep the old bridge code for rollback, including markers for previously absent files.
  for file in "${FILES[@]}"; do
    /bin/mkdir -p "$RELEASE/$(dirname "$file")"
    if [[ -f "$CODE/$file" ]]; then /bin/cp -p "$CODE/$file" "$RELEASE/$file"; else /usr/bin/touch "$RELEASE/$file.absent"; fi
  done
  BEFORE=$(backup)
  installed=0
  rollback() {
    status=$?
    if (( status != 0 && installed )); then
      for file in "${FILES[@]}"; do
        if [[ -f "$RELEASE/$file.absent" ]]; then /bin/rm -f "$CODE/$file"; else /usr/bin/install -o root -g wheel -m 644 "$RELEASE/$file" "$CODE/$file"; fi
      done
      /bin/launchctl kickstart -k "system/$LABEL" || true
      echo 'Bridge code restored; private data was not rolled back.' >&2
    fi
  }
  trap rollback EXIT
  installed=1
  for file in "${FILES[@]}"; do /usr/bin/install -o root -g wheel -m 644 "$STAGE/$file" "$CODE/$file"; done
  run --import tsx scripts/check-assistant-release.ts idle "$PRIVATE/afterimage.sqlite"
  RESTORE="$PRIVATE/migration/assistant-preflight-$$.sqlite"
  /usr/bin/sudo -u _afterimage /usr/bin/sqlite3 "$BEFORE" ".backup '$RESTORE'"
  run --import tsx scripts/check-assistant-release.ts restore "$RESTORE"
  /bin/rm -f "$RESTORE" "$RESTORE-wal" "$RESTORE-shm"
  /bin/launchctl kickstart -k "system/$LABEL"
  # Existing signed status remains compatible. Do not migrate live legacy turns before the web cutover.
  for attempt in 1 2 3 4 5; do
    if /usr/bin/sudo -u _afterimage /usr/bin/env NODE_ENV=development AFTERIMAGE_STORAGE=macserver AFTERIMAGE_BACKEND_URL=http://127.0.0.1:3102 /usr/local/bin/node --env-file="$PRIVATE/service.env" --import tsx --input-type=module -e 'import {macserverRequest} from "./src/lib/macserver-client.ts";const s=await macserverRequest({action:"status"});if(!Number.isSafeInteger(s.version))process.exit(1);console.log("Signed bridge status OK");'; then break; fi
    (( attempt < 5 )) || exit 1
    /bin/sleep 1
  done
  echo 'Bridge installed. Production database backup and migration rehearsal passed. Proceed with compatible web/API, then assistant worker.'
else
  BACKUP=$(backup)
  RESTORE="$PRIVATE/migration/assistant-release-restore-$$.sqlite"
  /usr/bin/sudo -u _afterimage /usr/bin/sqlite3 "$BACKUP" ".backup '$RESTORE'"
  run --import tsx scripts/check-assistant-release.ts verify "$RESTORE"
  /bin/rm -f "$RESTORE" "$RESTORE-wal" "$RESTORE-shm"
  /bin/launchctl print system/dev.aarushagarwal.afterimage-backup-isolated | /usr/bin/grep -E 'state =|last exit code|interval|Hour|Minute'
  echo 'Post-cutover backup restore verified. Backups remain on macserver only.'
fi

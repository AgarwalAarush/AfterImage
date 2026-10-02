#!/bin/bash
# One-time isolated connector install. Does not restart or modify the storage bridge.
set -euo pipefail
umask 077

MODE=${1:-}
STAGE=${2:-}
EXPECTED_SHA=${3:-}
RESUME_ACCOUNT=${4:-}
BASE=/Users/Shared/AfterImageTunnel
ACCOUNT=_afterimage_tunnel
UID_NUMBER=498
LABEL=dev.aarushagarwal.afterimage-cloudflare
PLIST=/Library/LaunchDaemons/$LABEL.plist
fail() { printf '%s\n' "$*" >&2; exit 1; }

[[ "$MODE" == --check || "$MODE" == --apply ]] ||
  fail 'Usage: bash install-cloudflare-storage-macserver.sh --check|--apply ABSOLUTE_STAGE BINARY_SHA256 [--resume-account]'
[[ -z "$RESUME_ACCOUNT" || "$RESUME_ACCOUNT" == --resume-account ]] || fail 'Unknown account recovery option.'
[[ "$(hostname -s)" == macserver && "$(uname -m)" == x86_64 ]] ||
  fail 'This installer is restricted to Intel macserver.'
[[ "$STAGE" == /* && -d "$STAGE" && ! -L "$STAGE" ]] || fail 'Invalid staging directory.'
[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{64}$ ]] || fail 'Expected an independently verified binary SHA256.'
[[ -f "$STAGE/cloudflared" && ! -L "$STAGE/cloudflared" ]] || fail 'Staged connector missing.'
ACTUAL_SHA=$(/usr/bin/shasum -a 256 "$STAGE/cloudflared" | /usr/bin/awk '{print $1}')
[[ "$ACTUAL_SHA" == "$EXPECTED_SHA" ]] || fail 'Connector checksum mismatch.'
[[ -f "$STAGE/token" && ! -L "$STAGE/token" ]] || fail 'Staged tunnel token missing.'
# Validate without displaying credential contents, including on failure.
/usr/bin/awk 'BEGIN {ok=1} NR>1 {ok=0} !/^[A-Za-z0-9_+\/=\-]+$/ {ok=0} END {exit !(ok && NR==1)}' \
  "$STAGE/token" || fail 'Tunnel token must contain exactly one encoded token.'
[[ $(/usr/bin/wc -c < "$STAGE/token") -le 4096 ]] || fail 'Tunnel token exceeds the expected bound.'
[[ ! -e "$BASE" && ! -e "$PLIST" ]] || fail 'Connector destination exists; inspect partial installation before retrying.'
[[ -d /Users/Shared/AfterImageService/private ]] || fail 'Existing isolated storage service is missing.'
account_exists=0
attribute() {
  /usr/bin/dscl . -read "/Users/$ACCOUNT" "$1" 2>/dev/null | /usr/bin/awk '{$1=""; sub(/^ /, ""); print}'
}
valid_account_guid() {
  [[ "$(attribute GeneratedUID)" =~ ^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$ ]]
}
if /usr/bin/dscl . -read "/Users/$ACCOUNT" >/dev/null 2>&1; then
  [[ "$RESUME_ACCOUNT" == --resume-account ]] || fail 'Connector account already exists; inspect it before proceeding.'
  [[ "$(attribute UniqueID)" == "$UID_NUMBER" && "$(attribute PrimaryGroupID)" == 20 &&
     "$(attribute UserShell)" == /usr/bin/false && "$(attribute NFSHomeDirectory)" == /var/empty ]] ||
    fail 'Existing connector account does not match the restricted staging account.'
  valid_account_guid || fail 'Existing connector account has no valid generated identity.'
  # dscl can exit successfully with no output for an absent attribute.
  if [[ -n "$(/usr/bin/dscl . -read "/Users/$ACCOUNT" AuthenticationAuthority 2>/dev/null || true)" ]]; then
    fail 'Existing connector account has authentication credentials; do not reuse it.'
  fi
  account_groups=" $(/usr/bin/id -G "$ACCOUNT") "
  [[ "$account_groups" != *' 0 '* && "$account_groups" != *' 80 '* ]] || fail 'Existing connector account has privileged group membership.'
  account_exists=1
fi
UID_OWNER=$(/usr/bin/dscl . -list /Users UniqueID | /usr/bin/awk -v uid="$UID_NUMBER" '$2==uid {print $1}')
[[ -z "$UID_OWNER" || ( "$account_exists" == 1 && "$UID_OWNER" == "$ACCOUNT" ) ]] || fail 'Connector UID is already allocated.'
[[ "$(/usr/bin/curl -sS --max-time 3 -X POST -H 'Content-Type: application/json' -o /dev/null -w '%{http_code}' http://127.0.0.1:3102/internal/storage)" == 401 ]] ||
  fail 'The existing localhost bridge did not reject an unsigned request.'
if [[ "$MODE" == --check ]]; then
  printf 'Connector preflight passed. --apply requires administrator authentication; storage is unchanged.\n'
  exit 0
fi
[[ "$(id -u)" == 0 ]] || fail 'Run --apply with sudo on macserver.'

if [[ "$account_exists" == 0 ]]; then
  /usr/bin/dscl . -create "/Users/$ACCOUNT"
  /usr/bin/dscl . -create "/Users/$ACCOUNT" UserShell /usr/bin/false
  /usr/bin/dscl . -create "/Users/$ACCOUNT" RealName 'AfterImage Cloudflare Connector'
  /usr/bin/dscl . -create "/Users/$ACCOUNT" UniqueID "$UID_NUMBER"
  /usr/bin/dscl . -create "/Users/$ACCOUNT" PrimaryGroupID 20
  /usr/bin/dscl . -create "/Users/$ACCOUNT" NFSHomeDirectory /var/empty
fi
# macOS assigns this identity when creating the record. Rewriting an existing
# GeneratedUID can be rejected even under sudo; preserve and validate it instead.
valid_account_guid || fail 'Connector account has no valid generated identity.'
/usr/bin/install -d -o root -g wheel -m 755 "$BASE" "$BASE/bin"
/usr/bin/install -d -o "$ACCOUNT" -g staff -m 700 "$BASE/private"
/usr/bin/install -o root -g wheel -m 755 "$STAGE/cloudflared" "$BASE/bin/cloudflared"
/usr/bin/install -o "$ACCOUNT" -g staff -m 600 "$STAGE/token" "$BASE/private/token"
# The ordinary worker account cannot retain the staged connector credential.
/bin/rm "$STAGE/token"
/usr/bin/sudo -u "$ACCOUNT" /usr/bin/test ! -r /Users/Shared/AfterImageService/private/service.env ||
  fail 'Connector can read storage credentials; do not start it.'
/usr/bin/sudo -u "$ACCOUNT" /usr/bin/test ! -r /Users/Shared/AfterImageService/private/afterimage.sqlite ||
  fail 'Connector can read SQLite; do not start it.'

/bin/cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$LABEL</string>
<key>UserName</key><string>$ACCOUNT</string>
<key>GroupName</key><string>staff</string>
<key>ProgramArguments</key><array>
<string>$BASE/bin/cloudflared</string><string>tunnel</string>
<string>--no-autoupdate</string><string>--loglevel</string><string>fatal</string>
<string>--metrics</string><string>127.0.0.1:3103</string>
<string>run</string><string>--token-file</string><string>$BASE/private/token</string>
</array>
<key>WorkingDirectory</key><string>$BASE</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>30</integer>
<key>StandardOutPath</key><string>/dev/null</string>
<key>StandardErrorPath</key><string>/dev/null</string>
<key>EnvironmentVariables</key><dict><key>HOME</key><string>/var/empty</string></dict>
</dict></plist>
PLIST
/usr/sbin/chown root:wheel "$PLIST"
/bin/chmod 644 "$PLIST"
/usr/bin/plutil -lint "$PLIST"
/bin/launchctl bootstrap system "$PLIST"
printf 'Isolated connector installed. Verify localhost readiness and authenticated external reads before changing Vercel or retiring Funnel.\n'

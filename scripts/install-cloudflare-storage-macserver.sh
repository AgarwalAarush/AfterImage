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
  fail 'Usage: bash install-cloudflare-storage-macserver.sh --check|--apply ABSOLUTE_STAGE BINARY_SHA256 [--resume-account|--resume-files]'
[[ -z "$RESUME_ACCOUNT" || "$RESUME_ACCOUNT" == --resume-account || "$RESUME_ACCOUNT" == --resume-files ]] || fail 'Unknown recovery option.'
[[ "$(hostname -s)" == macserver && "$(uname -m)" == x86_64 ]] ||
  fail 'This installer is restricted to Intel macserver.'
[[ "$STAGE" == /* && -d "$STAGE" && ! -L "$STAGE" ]] || fail 'Invalid staging directory.'
[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{64}$ ]] || fail 'Expected an independently verified binary SHA256.'
[[ -f "$STAGE/cloudflared" && ! -L "$STAGE/cloudflared" ]] || fail 'Staged connector missing.'
ACTUAL_SHA=$(/usr/bin/shasum -a 256 "$STAGE/cloudflared" | /usr/bin/awk '{print $1}')
[[ "$ACTUAL_SHA" == "$EXPECTED_SHA" ]] || fail 'Connector checksum mismatch.'
TOKEN_SOURCE="$STAGE/token"
if [[ "$RESUME_ACCOUNT" == --resume-files ]]; then
  [[ "$(id -u)" == 0 ]] || fail 'Inspecting the installed private credential requires administrator authentication.'
  [[ -d "$BASE" && ! -L "$BASE" && ! -e "$PLIST" ]] || fail 'Unexpected partial installation.'
  for item in "$BASE/bin" "$BASE/private" "$BASE/bin/cloudflared" "$BASE/private/token"; do
    [[ -e "$item" && ! -L "$item" ]] || fail 'Partial installation contains a missing or linked file.'
  done
  [[ "$(/usr/bin/stat -f '%u:%g:%Lp' "$BASE")" == 0:0:755 &&
     "$(/usr/bin/stat -f '%u:%g:%Lp' "$BASE/bin")" == 0:0:755 &&
     "$(/usr/bin/stat -f '%u:%g:%Lp' "$BASE/bin/cloudflared")" == 0:0:755 &&
     "$(/usr/bin/stat -f '%u:%g:%Lp' "$BASE/private")" == "$UID_NUMBER":20:700 &&
     "$(/usr/bin/stat -f '%u:%g:%Lp' "$BASE/private/token")" == "$UID_NUMBER":20:600 ]] ||
    fail 'Partial installation ownership or permissions differ from the reviewed installer.'
  [[ "$(/bin/ls -A "$BASE")" == $'bin\nprivate' && "$(/bin/ls -A "$BASE/bin")" == cloudflared &&
     "$(/bin/ls -A "$BASE/private")" == token ]] || fail 'Partial installation contains unexpected files.'
  [[ "$(/usr/bin/shasum -a 256 "$BASE/bin/cloudflared" | /usr/bin/awk '{print $1}')" == "$EXPECTED_SHA" ]] ||
    fail 'Installed connector checksum differs from the reviewed release.'
  [[ ! -e "$STAGE/token" ]] || fail 'Staged credential unexpectedly remains after file installation.'
  TOKEN_SOURCE="$BASE/private/token"
else
  [[ ! -e "$BASE" && ! -e "$PLIST" ]] || fail 'Connector destination exists; inspect partial installation before retrying.'
fi
[[ -f "$TOKEN_SOURCE" && ! -L "$TOKEN_SOURCE" ]] || fail 'Tunnel token missing.'
# Validate without displaying credential contents, including on failure.
/usr/bin/awk 'BEGIN {ok=1} NR>1 {ok=0} !/^[A-Za-z0-9_+\/=\-]+$/ {ok=0} END {exit !(ok && NR==1)}' \
  "$TOKEN_SOURCE" || fail 'Tunnel token must contain exactly one encoded token.'
[[ $(/usr/bin/wc -c < "$TOKEN_SOURCE") -le 4096 ]] || fail 'Tunnel token exceeds the expected bound.'
[[ -d /Users/Shared/AfterImageService/private ]] || fail 'Existing isolated storage service is missing.'
account_exists=0
attribute() {
  /usr/bin/dscl . -read "/Users/$ACCOUNT" "$1" 2>/dev/null | /usr/bin/awk '{$1=""; sub(/^ /, ""); print}'
}
valid_account_guid() {
  [[ "$(attribute GeneratedUID)" =~ ^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$ ]]
}
if /usr/bin/dscl . -read "/Users/$ACCOUNT" >/dev/null 2>&1; then
  [[ "$RESUME_ACCOUNT" == --resume-account || "$RESUME_ACCOUNT" == --resume-files ]] || fail 'Connector account already exists; inspect it before proceeding.'
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
[[ "$RESUME_ACCOUNT" != --resume-files || "$account_exists" == 1 ]] || fail 'Installed connector account is missing.'
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
if [[ "$RESUME_ACCOUNT" != --resume-files ]]; then
  /usr/bin/install -d -o root -g wheel -m 755 "$BASE" "$BASE/bin"
  /usr/bin/install -d -o "$ACCOUNT" -g staff -m 700 "$BASE/private"
  /usr/bin/install -o root -g wheel -m 755 "$STAGE/cloudflared" "$BASE/bin/cloudflared"
  /usr/bin/install -o "$ACCOUNT" -g staff -m 600 "$STAGE/token" "$BASE/private/token"
  # The ordinary worker account cannot retain the staged connector credential.
  /bin/rm "$STAGE/token"
fi
[[ -x /bin/test ]] || fail 'Required macOS access-check utility is unavailable.'
/usr/bin/sudo -u "$ACCOUNT" /bin/test ! -r /Users/Shared/AfterImageService/private/service.env ||
  fail 'Storage credential isolation check failed; do not start the connector.'
/usr/bin/sudo -u "$ACCOUNT" /bin/test ! -r /Users/Shared/AfterImageService/private/afterimage.sqlite ||
  fail 'SQLite isolation check failed; do not start the connector.'

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

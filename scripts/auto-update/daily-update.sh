#!/bin/bash
#
# Daily admin_panel update CHECK (check-only — never auto-applies). Notifies via
# Telegram + email when a newer panel is available. Opt-in: enable the "Daily
# update check" toggle in /admin/automation (writes cms-data/automation.json
# autoUpdate.enabled=true). Applying an update is a deliberate, backed-up action
# from the same page.
#
# Install on the host (runs as the site user), e.g. via `crontab -e`:
#   23 7 * * *  /home/<site>/htdocs/<site>/vendor/admin-panel/scripts/auto-update/daily-update.sh >> /home/<site>/htdocs/<site>/logs/auto-update.log 2>&1
#
ROOT="${SHARED_ROOT:-$(pwd)}"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 0
exec node "$DIR/check-updates.mjs"

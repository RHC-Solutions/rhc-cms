#!/bin/bash
#
# Weekly safe dependency updater. Applies patch+minor updates only (npm update
# respects the "^" ranges in package.json, so majors are never touched), builds
# + typechecks + lints in an ISOLATED worktree with its OWN node_modules, and —
# only if everything is green — opens a PR. Majors stay manual (reported daily).
#
# Manual run:  scripts/audit/weekly-deps.sh

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$HOME/.local/bin"

# Per-site config — override via env. REPO_DIR defaults to the repo root two
# levels up from this script so a fresh clone works with no edits.
REPO_DIR="${AUDIT_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
REMOTE="${AUDIT_GIT_REMOTE:-origin}"
BASE_BRANCH="${AUDIT_BASE_BRANCH:-main}"
GH_REPO="${AUDIT_GH_REPO:-}"               # owner/repo for `gh pr create`; required to open PRs
DATE="$(date '+%Y-%m-%d')"
ART_DIR="$REPO_DIR/logs/audit/$DATE"
LOG_FILE="$REPO_DIR/logs/audit/cron.log"
LOCK_FILE="${AUDIT_DEPS_LOCK_FILE:-/tmp/rhc-deps.lock}"
BRANCH="deps/auto-update-$DATE"
WT_DIR="${AUDIT_WORKTREE_DIR:-$HOME/audit-worktrees}/deps-$DATE"
SUMMARY="$ART_DIR/weekly-summary.md"

mkdir -p "$ART_DIR"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

if [ -f "$LOCK_FILE" ]; then log "Another weekly-deps run is active. Exiting."; exit 0; fi
touch "$LOCK_FILE"
cleanup() {
    git -C "$REPO_DIR" worktree remove --force "$WT_DIR" >>"$LOG_FILE" 2>&1 || rm -rf "$WT_DIR"
    git -C "$REPO_DIR" worktree prune >>"$LOG_FILE" 2>&1
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

log "=== Weekly deps start ($DATE) ==="
cd "$REPO_DIR" || { log "ERROR: cannot cd repo"; exit 1; }

# Honor admin-managed config (cms-data/automation.json, via /admin/automation).
cfg() { node "$REPO_DIR/scripts/audit/config.mjs" get "$1" 2>/dev/null; }
if [ "$(cfg weekly.enabled)" = "false" ]; then
    log "Weekly dep updater is disabled in automation.json — exiting."; exit 0
fi
RECIPIENT="$(cfg recipientEmail)"

# Refresh the dependency report so the email's major-update list is current.
node "$REPO_DIR/scripts/audit/collect-deps.mjs" "$DATE" >>"$LOG_FILE" 2>&1 || true

git fetch "$REMOTE" "$BASE_BRANCH" >>"$LOG_FILE" 2>&1
mkdir -p "$(dirname "$WT_DIR")"
git worktree remove --force "$WT_DIR" >>"$LOG_FILE" 2>&1 || true
if ! git worktree add -B "$BRANCH" "$WT_DIR" "$REMOTE/$BASE_BRANCH" >>"$LOG_FILE" 2>&1; then
    log "✗ worktree add failed"; exit 1
fi
# Only symlink GITIGNORED files. Never symlink the tracked cms-data/secrets.json
# (the worktree already has it from checkout; a symlink would be committed as a
# type-change).
[ -f "$REPO_DIR/.env.local" ]      && ln -sfn "$REPO_DIR/.env.local"      "$WT_DIR/.env.local"
[ -f "$REPO_DIR/cms-data/cms.db" ] && ln -sfn "$REPO_DIR/cms-data/cms.db" "$WT_DIR/cms-data/cms.db"
# Populate the vendor/admin-panel submodule so @adminpanel/* imports resolve.
( cd "$WT_DIR" && git submodule update --init --recursive >>"$LOG_FILE" 2>&1 ) || log "  ! submodule init failed"

cd "$WT_DIR" || { log "ERROR: cannot cd worktree"; exit 1; }

STATUS="ok"; DETAIL=""
log "Installing baseline deps in worktree (own node_modules)..."
# --legacy-peer-deps matches how this repo installs (eslint peer-dep conflict).
npm ci --legacy-peer-deps >>"$LOG_FILE" 2>&1 || npm install --legacy-peer-deps >>"$LOG_FILE" 2>&1

log "Applying patch+minor updates (npm update --save)..."
npm update --save --legacy-peer-deps >>"$LOG_FILE" 2>&1

CHANGES="$(git -C "$WT_DIR" status --porcelain -- package.json package-lock.json)"
if [ -z "$CHANGES" ]; then
    log "No safe (patch/minor) updates available."
    STATUS="none"
else
    DIFF="$(git -C "$WT_DIR" diff --stat package.json package-lock.json)"
    log "Updates applied; verifying build + types + lint..."
    if npm run build >>"$LOG_FILE" 2>&1 \
       && npx --no-install tsc --noEmit >>"$LOG_FILE" 2>&1 \
       && npm run lint >>"$LOG_FILE" 2>&1; then
        STATUS="green"
        DETAIL="$DIFF"
    else
        STATUS="failed"
        DETAIL="$DIFF"
        log "✗ verification failed — discarding updates"
        git -C "$WT_DIR" checkout -- package.json package-lock.json >>"$LOG_FILE" 2>&1
    fi
fi

PR_URL=""
if [ "$STATUS" = "green" ]; then
    git -C "$WT_DIR" add package.json package-lock.json
    git -C "$WT_DIR" commit -m "Weekly deps: safe patch/minor updates ($DATE)

Applied via npm update --save (within ^ ranges; no majors).
Build + tsc --noEmit + lint all green.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" >>"$LOG_FILE" 2>&1
    if git -C "$WT_DIR" push -u "$REMOTE" "$BRANCH" >>"$LOG_FILE" 2>&1; then
        PR_URL=$(gh pr create --repo "$GH_REPO" --base "$BASE_BRANCH" --head "$BRANCH" \
            --title "Weekly deps: patch/minor updates ($DATE)" \
            --body "Automated safe dependency bump (patch+minor only; majors excluded). Build, typecheck and lint passed.

\`\`\`
$DETAIL
\`\`\`" 2>>"$LOG_FILE") && log "✓ PR: $PR_URL" || log "✗ gh pr create failed"
    fi
fi

# ---- summary + email ----
{
    echo "Weekly dependency update — $DATE"
    case "$STATUS" in
        green)  echo "Applied safe patch/minor updates; build+tsc+lint green. PR opened.";;
        none)   echo "No patch/minor updates were available within the current ^ ranges.";;
        failed) echo "Safe updates were available but FAILED verification (build/tsc/lint). Reverted — no PR. See logs/audit/cron.log.";;
        *)      echo "Run completed with status: $STATUS";;
    esac
    [ -n "$DETAIL" ] && { echo ""; echo "$DETAIL"; }
    echo ""
    echo "Major updates are never auto-applied — see the major list in the daily audit email."
} > "$SUMMARY"

AUDIT_MODE=weekly \
AUDIT_PR_URL="$PR_URL" \
AUDIT_REPORT_TO="$RECIPIENT" \
AUDIT_SUMMARY_FILE="$SUMMARY" \
node "$REPO_DIR/scripts/audit/send-report.mjs" "$DATE" >>"$LOG_FILE" 2>&1 || log "  ! email send errored"

log "=== Weekly deps complete ($DATE) — status=$STATUS ==="

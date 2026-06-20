#!/bin/bash
#
# Daily SEO / AI-readiness / performance audit + safe auto-fix PR + email digest.
#
# Design notes:
#   * Designed to run from cron, alongside any auto-sync job that does
#     `git add -A && commit && push` on the MAIN working tree every
#     30 min). To avoid racing that, all auto-fix work happens in an ISOLATED git
#     worktree — the main tree is never touched, so nothing the audit does can be
#     swept into an auto-sync commit on master.
#   * Collectors are read-only and run against the live server + main cms.db.
#   * The headless `claude` pass is sandboxed to edits + build verification; this
#     script (not claude) owns every git/gh operation.
#
# Manual run:  scripts/audit/daily-audit.sh

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$HOME/.local/bin"

# Per-site config — override via env (e.g. an EnvironmentFile / cron env).
# REPO_DIR defaults to the git repo two levels up from this script
# (scripts/audit/ -> repo root), so a fresh clone works with no edits.
REPO_DIR="${AUDIT_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
REMOTE="${AUDIT_GIT_REMOTE:-origin}"       # name of the git remote to push to
BASE_BRANCH="${AUDIT_BASE_BRANCH:-main}"   # branch PRs are opened against
GH_REPO="${AUDIT_GH_REPO:-}"               # owner/repo for `gh pr create`; required for autofix=pr
DATE="$(date '+%Y-%m-%d')"
ART_DIR="$REPO_DIR/logs/audit/$DATE"
LOG_FILE="$REPO_DIR/logs/audit/cron.log"
LOCK_FILE="${AUDIT_LOCK_FILE:-/tmp/rhc-audit.lock}"
BRANCH="audit/auto-fix-$DATE"
WT_DIR="${AUDIT_WORKTREE_DIR:-$HOME/audit-worktrees}/$DATE"
CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.local/bin/claude}"
SITE_HOST="$(echo "${NEXT_PUBLIC_SITE_URL:-}" | sed -E 's#^https?://##; s#/$##')"
[ -z "$SITE_HOST" ] && SITE_HOST="this site"

mkdir -p "$ART_DIR"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

if [ -f "$LOCK_FILE" ]; then log "Another audit run is active. Exiting."; exit 0; fi
touch "$LOCK_FILE"

cleanup() {
    log "Cleaning up worktree..."
    git -C "$REPO_DIR" worktree remove --force "$WT_DIR" >>"$LOG_FILE" 2>&1 || rm -rf "$WT_DIR"
    git -C "$REPO_DIR" worktree prune >>"$LOG_FILE" 2>&1
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

log "=== Daily audit start ($DATE) ==="
cd "$REPO_DIR" || { log "ERROR: cannot cd repo"; exit 1; }

# ---------------------------------------------------------------------------
# 0) Honor admin-managed config (cms-data/automation.json, via /admin/automation)
# ---------------------------------------------------------------------------
cfg() { node "$REPO_DIR/scripts/audit/config.mjs" get "$1" 2>/dev/null; }
if [ "$(cfg daily.enabled)" = "false" ]; then
    log "Daily audit is disabled in automation.json — exiting."; exit 0
fi
AUTOFIX="$(cfg daily.autofix)"            # 'pr' (open fix PR) | 'off' (report only)
RECIPIENT="$(cfg recipientEmail)"          # '' => send-report falls back to ADMIN_EMAIL
[ -z "$AUTOFIX" ] && AUTOFIX="pr"
log "Config: autofix=$AUTOFIX recipient=${RECIPIENT:-<default>}"

# ---------------------------------------------------------------------------
# 1) Collectors (read-only, against the running site + main cms.db)
# ---------------------------------------------------------------------------
log "Running collectors..."
for c in seo ai perf deps; do
    log "  collect-$c"
    node "$REPO_DIR/scripts/audit/collect-$c.mjs" "$DATE" >>"$LOG_FILE" 2>&1 || log "  ! collect-$c errored (continuing)"
done

# ---------------------------------------------------------------------------
# 2) Isolated worktree for any auto-fixes
# ---------------------------------------------------------------------------
log "Preparing worktree $WT_DIR off $REMOTE/$BASE_BRANCH"
git fetch "$REMOTE" "$BASE_BRANCH" >>"$LOG_FILE" 2>&1
mkdir -p "$(dirname "$WT_DIR")"
git worktree remove --force "$WT_DIR" >>"$LOG_FILE" 2>&1 || true
if ! git worktree add -B "$BRANCH" "$WT_DIR" "$REMOTE/$BASE_BRANCH" >>"$LOG_FILE" 2>&1; then
    log "✗ worktree add failed — emailing audit-only digest"
    AUDIT_MODE=daily AUDIT_REPORT_TO="$RECIPIENT" node "$REPO_DIR/scripts/audit/send-report.mjs" "$DATE" >>"$LOG_FILE" 2>&1
    exit 0
fi
# Make gitignored-but-build-required data available inside the worktree.
# NOTE: do NOT symlink node_modules — Turbopack rejects a node_modules symlink
# that escapes the project root ("points out of the filesystem root"). And do NOT
# symlink/hardlink into the live node_modules — a build write could corrupt the
# running site. Instead install an isolated node_modules via `npm ci` below.
# Also do NOT symlink .next — the worktree builds into its own .next.
# Only symlink GITIGNORED files (.env.local, cms.db). NEVER symlink a TRACKED
# file like cms-data/secrets.json — `git add -A` would record the symlink as a
# type-change and the PR would rewrite the tracked file. The worktree already
# has secrets.json from its checkout, so no symlink is needed.
[ -f "$REPO_DIR/.env.local" ] && ln -sfn "$REPO_DIR/.env.local" "$WT_DIR/.env.local"
[ -f "$REPO_DIR/cms-data/cms.db" ] && ln -sfn "$REPO_DIR/cms-data/cms.db" "$WT_DIR/cms-data/cms.db"

# The @adminpanel/* path alias resolves to the vendor/admin-panel git submodule,
# which a fresh worktree does not check out — without this the build can't
# resolve @adminpanel imports.
( cd "$WT_DIR" && git submodule update --init --recursive >>"$LOG_FILE" 2>&1 ) || log "  ! submodule init failed — build may fail on @adminpanel imports"

log "Installing isolated node_modules in worktree (npm ci)..."
# --legacy-peer-deps matches how this repo's node_modules is installed (eslint
# peer-dep conflict otherwise trips strict resolution).
( cd "$WT_DIR" && npm ci --legacy-peer-deps >>"$LOG_FILE" 2>&1 ) || log "  ! npm ci failed — build/typecheck inside the agent run may not work"

# ---------------------------------------------------------------------------
# 3) Sandboxed headless Claude: apply ONLY safe fixes, verify, write summaries
# ---------------------------------------------------------------------------
if [ "$AUTOFIX" = "off" ]; then
    FIX_INSTR="AUTO-FIX IS DISABLED (report-only mode). Do NOT edit any files. Only read the artifacts + ./CLAUDE.md and write report.md + email.md describing the findings and the fixes you WOULD recommend."
else
    FIX_INSTR="Apply ONLY safe, high-confidence fixes for SEO + AI findings:
       - meta title/description length/quality fixes by editing cms-data/pages.json
         (then run: node scripts/sync-seo-from-json.mjs to push into cms.db)
       - missing/invalid JSON-LD, alt text, heading/canonical issues
       - low-risk content/structure tweaks that improve answer-readiness
     Prefer the smallest correct change. Match existing code style.
     After edits, run: npm run build (and npx --no-install tsc --noEmit if you
     touched .ts/.tsx). If anything fails, REVERT that change and move on."
fi
PROMPT=$(cat <<EOF
You are the automated daily site-quality agent for $SITE_HOST. Today is $DATE.

The deterministic audit artifacts for today are JSON files at:
  $ART_DIR/seo.json   (SEO issues: meta lengths, canonical, h1, sitemap)
  $ART_DIR/ai.json    (AI crawler access, JSON-LD validity/coverage, GEO/E-E-A-T)
  $ART_DIR/perf.json  (PageSpeed Insights scores + opportunities)
  $ART_DIR/deps.json  (dependency updates — DO NOT act on these)

Your working directory is an isolated git worktree on branch $BRANCH. Follow the
conventions in ./CLAUDE.md exactly (read it first).

DO:
  1. Read all four artifacts and ./CLAUDE.md.
  2. $FIX_INSTR
  3. Write a human-readable report to: $ART_DIR/report.md
     and a concise (<=12 line) plaintext email summary to: $ART_DIR/email.md
     Lead with: what you fixed, what still needs a human, top perf opportunity.

DO NOT:
  - touch package.json / package-lock.json / dependencies
  - run any git or gh command (this script handles commits + the PR)
  - change auth, middleware, CSP, analytics, or anything CLAUDE.md says not to
  - make speculative or large refactors — when unsure, leave it for the report

If there are no safe fixes to make, make no edits and just write report.md +
email.md describing the findings.
EOF
)

log "Invoking Claude (sandboxed) in worktree..."
( cd "$WT_DIR" && timeout 1800 "$CLAUDE_BIN" -p "$PROMPT" \
    --permission-mode acceptEdits \
    --add-dir "$ART_DIR" \
    --allowedTools "Read,Edit,Write,Bash(node scripts/sync-seo-from-json.mjs),Bash(node scripts/inline-critical-css.mjs),Bash(npm run build),Bash(npx --no-install tsc --noEmit)" \
    >>"$LOG_FILE" 2>&1 ) || log "  ! claude exited non-zero (continuing)"

# ---------------------------------------------------------------------------
# 4) Commit + push + PR if the agent changed anything
# ---------------------------------------------------------------------------
PR_URL=""
cd "$WT_DIR" || true
# Never let a tracked-but-unexpected file (notably cms-data/secrets.json) ride
# along in the auto-fix PR.
PATHSPEC=(':!node_modules' ':!.next' ':!cms-data/secrets.json')
if [ "$AUTOFIX" = "off" ]; then
    log "Report-only mode — discarding any edits, no PR."
    git -C "$WT_DIR" checkout -- . >>"$LOG_FILE" 2>&1 || true
elif [ -n "$(git -C "$WT_DIR" status --porcelain -- "${PATHSPEC[@]}")" ]; then
    log "Changes detected — committing to $BRANCH"
    git -C "$WT_DIR" add -A -- "${PATHSPEC[@]}"
    git -C "$WT_DIR" commit -m "Daily audit auto-fix: $DATE

Automated SEO/AI-readiness fixes from scripts/audit/daily-audit.sh.
See logs/audit/$DATE/report.md for the full audit.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" >>"$LOG_FILE" 2>&1

    if git -C "$WT_DIR" push -u "$REMOTE" "$BRANCH" >>"$LOG_FILE" 2>&1; then
        PR_BODY="Automated daily audit fixes for $DATE. Review the diff before merging — merging deploys via the normal flow.

\`\`\`
$(sed -n '1,60p' "$ART_DIR/report.md" 2>/dev/null)
\`\`\`"
        PR_URL=$(gh pr create --repo "$GH_REPO" --base "$BASE_BRANCH" --head "$BRANCH" \
            --title "Daily audit auto-fix: $DATE" --body "$PR_BODY" 2>>"$LOG_FILE") \
            && log "✓ PR: $PR_URL" || log "✗ gh pr create failed (branch pushed; open PR manually)"
    else
        log "✗ push failed — no PR created"
    fi
else
    log "No auto-fixes this run."
fi

# ---------------------------------------------------------------------------
# 5) Email digest
# ---------------------------------------------------------------------------
log "Sending email digest..."
AUDIT_MODE=daily \
AUDIT_PR_URL="$PR_URL" \
AUDIT_REPORT_TO="$RECIPIENT" \
AUDIT_SUMMARY_FILE="$ART_DIR/email.md" \
node "$REPO_DIR/scripts/audit/send-report.mjs" "$DATE" >>"$LOG_FILE" 2>&1 || log "  ! email send errored"

log "=== Daily audit complete ($DATE) ==="

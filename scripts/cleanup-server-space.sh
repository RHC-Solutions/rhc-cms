#!/usr/bin/env bash
set -euo pipefail

VSCODE_SERVER_DIR="${VSCODE_SERVER_DIR:-/root/.vscode-server}"
SITE_PM2_LOG_DIR="${SITE_PM2_LOG_DIR:-/home/rhcsolutions_com/.pm2/logs}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
KEEP_TSSERVER_LOG_DIRS="${KEEP_TSSERVER_LOG_DIRS:-5}"

cleanup_old_vscode_session_logs() {
  local log_root="$VSCODE_SERVER_DIR/data/logs"
  if [[ -d "$log_root" ]]; then
    find "$log_root" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} +
  fi
}

cleanup_old_copilot_artifacts() {
  local workspace_storage="$VSCODE_SERVER_DIR/data/User/workspaceStorage"
  if [[ -d "$workspace_storage" ]]; then
    find "$workspace_storage" \
      \( -path "*/GitHub.copilot-chat/debug-logs/*" \
      -o -path "*/GitHub.copilot-chat/transcripts/*" \
      -o -path "*/GitHub.copilot-chat/chat-session-resources/*" \) \
      -mtime "+$RETENTION_DAYS" -exec rm -rf {} +
  fi
}

prune_tsserver_trace_dirs() {
  local tsserver_root="$VSCODE_SERVER_DIR/data/logs"
  [[ -d "$tsserver_root" ]] || return 0

  while IFS= read -r parent_dir; do
    mapfile -t stale_dirs < <(
      find "$parent_dir" -mindepth 1 -maxdepth 1 -type d -name 'tsserver-log-*' -printf '%T@ %p\n' \
        | sort -nr \
        | awk -v keep="$KEEP_TSSERVER_LOG_DIRS" 'NR > keep { sub(/^[^ ]+ /, ""); print }'
    )

    if (( ${#stale_dirs[@]} > 0 )); then
      rm -rf "${stale_dirs[@]}"
    fi
  done < <(find "$tsserver_root" -type d -path '*/vscode.typescript-language-features' 2>/dev/null)
}

cleanup_old_site_pm2_logs() {
  if [[ -d "$SITE_PM2_LOG_DIR" ]]; then
    find "$SITE_PM2_LOG_DIR" -maxdepth 1 -type f -name '*.log' -mtime "+$RETENTION_DAYS" -delete
  fi
}

cleanup_old_vscode_session_logs
cleanup_old_copilot_artifacts
prune_tsserver_trace_dirs
cleanup_old_site_pm2_logs
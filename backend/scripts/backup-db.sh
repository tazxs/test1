#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# NalogAI — Automated PostgreSQL Backup Script
#
# Creates a compressed daily backup of the PostgreSQL database.
# Designed to run via cron or Docker healthcheck.
#
# Usage:
#   ./scripts/backup-db.sh                    # Uses env vars
#   BACKUP_DIR=/backups ./scripts/backup-db.sh # Custom backup directory
#
# Environment variables:
#   DATABASE_URL    — PostgreSQL connection string (required)
#   BACKUP_DIR      — Directory to store backups (default: ./backups)
#   BACKUP_RETAIN   — Number of days to keep backups (default: 30)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env if present
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
BACKUP_RETAIN="${BACKUP_RETAIN:-30}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/nalogai_${TIMESTAMP}.sql.gz"
LOG_FILE="$BACKUP_DIR/backup.log"

# ── Validate ──────────────────────────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set. Aborting." >&2
  exit 1
fi

# ── Ensure backup directory exists ────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Logging helper ────────────────────────────────────────────────────────────
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

# ── Create backup ─────────────────────────────────────────────────────────────
log "Starting backup → $BACKUP_FILE"

# pg_dump with custom format for flexibility, piped through gzip
if pg_dump "$DATABASE_URL" --no-owner --no-acl --format=plain 2>>"$LOG_FILE" | gzip > "$BACKUP_FILE"; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "Backup completed successfully. Size: $BACKUP_SIZE"
else
  log "[ERROR] Backup failed!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# ── Verify backup integrity ──────────────────────────────────────────────────
if gzip -t "$BACKUP_FILE" 2>/dev/null; then
  log "Backup integrity check: PASSED"
else
  log "[ERROR] Backup integrity check: FAILED — file is corrupted"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# ── Cleanup old backups ──────────────────────────────────────────────────────
DELETED_COUNT=0
while IFS= read -r old_file; do
  rm -f "$old_file"
  DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "$BACKUP_DIR" -name "nalogai_*.sql.gz" -type f -mtime +"$BACKUP_RETAIN" 2>/dev/null)

if [ "$DELETED_COUNT" -gt 0 ]; then
  log "Cleaned up $DELETED_COUNT backup(s) older than $BACKUP_RETAIN days"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "nalogai_*.sql.gz" -type f 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log "Backup directory: $BACKUP_DIR | Total backups: $TOTAL_BACKUPS | Total size: $TOTAL_SIZE"
log "Done."

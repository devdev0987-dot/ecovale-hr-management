#!/bin/bash
# =================================================================
# MySQL Database Backup Script for Ecovale HR System
# =================================================================
# This script creates automated backups of the MySQL database
# with compression, retention policy, and error handling
# =================================================================

set -euo pipefail  # Exit on error, undefined variables, pipe failures

# =================================================================
# CONFIGURATION
# =================================================================

# Database credentials (use environment variables for security)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-ecovale_hr}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-yourpassword}"

# Backup configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS=30  # Keep backups for 30 days
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="ecovale_hr_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Email notification (optional)
NOTIFY_EMAIL="${NOTIFY_EMAIL:-}"
NOTIFY_ON_SUCCESS="${NOTIFY_ON_SUCCESS:-false}"
NOTIFY_ON_FAILURE="${NOTIFY_ON_FAILURE:-true}"

# =================================================================
# COLORS FOR OUTPUT
# =================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =================================================================
# FUNCTIONS
# =================================================================

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
}

send_notification() {
    local subject="$1"
    local message="$2"
    
    if [ -n "$NOTIFY_EMAIL" ]; then
        echo "$message" | mail -s "$subject" "$NOTIFY_EMAIL" 2>/dev/null || true
    fi
}

cleanup_old_backups() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days..."
    find "$BACKUP_DIR" -name "ecovale_hr_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
    success "Old backups cleaned up"
}

# =================================================================
# PRE-FLIGHT CHECKS
# =================================================================

log "Starting MySQL backup for Ecovale HR database"
log "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"

# Check if mysqldump is available
if ! command -v mysqldump &> /dev/null; then
    error "mysqldump command not found. Please install MySQL client tools."
    exit 1
fi

# Check if gzip is available
if ! command -v gzip &> /dev/null; then
    warning "gzip not found. Backup will not be compressed."
    COMPRESS_BACKUP=false
else
    COMPRESS_BACKUP=true
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# =================================================================
# PERFORM BACKUP
# =================================================================

log "Creating database backup..."
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Perform mysqldump with options
mysqldump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --password="$DB_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --add-drop-table \
    --add-locks \
    --quick \
    --lock-tables=false \
    "$DB_NAME" > "$BACKUP_PATH" 2>&1

BACKUP_EXIT_CODE=$?

if [ $BACKUP_EXIT_CODE -ne 0 ]; then
    error "Database backup failed with exit code: $BACKUP_EXIT_CODE"
    
    # Remove partial backup file
    [ -f "$BACKUP_PATH" ] && rm -f "$BACKUP_PATH"
    
    # Send failure notification
    if [ "$NOTIFY_ON_FAILURE" = true ]; then
        send_notification "Ecovale HR Backup Failed" "Database backup failed at $(date)"
    fi
    
    exit 1
fi

success "Database backup created: $BACKUP_FILE"

# Get backup file size
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
log "Backup size: $BACKUP_SIZE"

# =================================================================
# COMPRESS BACKUP
# =================================================================

if [ "$COMPRESS_BACKUP" = true ]; then
    log "Compressing backup..."
    gzip -f "$BACKUP_PATH"
    COMPRESSED_PATH="${BACKUP_DIR}/${COMPRESSED_FILE}"
    
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)
    success "Backup compressed: $COMPRESSED_FILE (${COMPRESSED_SIZE})"
    
    FINAL_BACKUP="$COMPRESSED_FILE"
    FINAL_SIZE="$COMPRESSED_SIZE"
else
    FINAL_BACKUP="$BACKUP_FILE"
    FINAL_SIZE="$BACKUP_SIZE"
fi

# =================================================================
# VERIFY BACKUP
# =================================================================

log "Verifying backup integrity..."

if [ "$COMPRESS_BACKUP" = true ]; then
    # Test gzip integrity
    if gzip -t "${BACKUP_DIR}/${COMPRESSED_FILE}" 2>/dev/null; then
        success "Backup verification successful"
    else
        error "Backup verification failed - compressed file is corrupted"
        exit 1
    fi
else
    # Check if file is readable and not empty
    if [ -s "$BACKUP_PATH" ]; then
        success "Backup verification successful"
    else
        error "Backup verification failed - file is empty or unreadable"
        exit 1
    fi
fi

# =================================================================
# CLEANUP OLD BACKUPS
# =================================================================

cleanup_old_backups

# =================================================================
# GENERATE BACKUP REPORT
# =================================================================

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "ecovale_hr_backup_*.sql.gz" | wc -l)

log "Backup Summary:"
echo "  Database: ${DB_NAME}"
echo "  Timestamp: ${TIMESTAMP}"
echo "  Backup File: ${FINAL_BACKUP}"
echo "  File Size: ${FINAL_SIZE}"
echo "  Location: ${BACKUP_DIR}"
echo "  Total Backups: ${BACKUP_COUNT}"
echo "  Retention: ${RETENTION_DAYS} days"

success "Backup completed successfully!"

# =================================================================
# SEND SUCCESS NOTIFICATION
# =================================================================

if [ "$NOTIFY_ON_SUCCESS" = true ]; then
    send_notification "Ecovale HR Backup Successful" \
        "Database backup completed successfully at $(date)
        File: ${FINAL_BACKUP}
        Size: ${FINAL_SIZE}
        Location: ${BACKUP_DIR}"
fi

# =================================================================
# OPTIONAL: UPLOAD TO S3 (Uncomment if using AWS S3)
# =================================================================

# if command -v aws &> /dev/null; then
#     log "Uploading backup to S3..."
#     S3_BUCKET="s3://your-bucket-name/ecovale-hr-backups/"
#     aws s3 cp "${BACKUP_DIR}/${FINAL_BACKUP}" "${S3_BUCKET}" --storage-class STANDARD_IA
#     success "Backup uploaded to S3"
# fi

exit 0

#!/bin/bash
# =================================================================
# MySQL Database Restore Script for Ecovale HR System
# =================================================================
# This script restores a database backup with safety checks
# =================================================================

set -euo pipefail

# =================================================================
# CONFIGURATION
# =================================================================

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-ecovale_hr}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-yourpassword}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"

# =================================================================
# COLORS
# =================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

confirm() {
    read -p "$1 (yes/no): " response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

list_backups() {
    log "Available backups in ${BACKUP_DIR}:"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ]; then
        error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
    
    local count=0
    while IFS= read -r file; do
        count=$((count + 1))
        local size=$(du -h "$file" | cut -f1)
        local date=$(echo "$file" | grep -oP '\d{8}_\d{6}')
        local formatted_date=$(date -d "${date:0:8} ${date:9:2}:${date:11:2}:${date:13:2}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Unknown")
        printf "%3d. %-50s %10s  %s\n" "$count" "$(basename "$file")" "$size" "$formatted_date"
    done < <(find "$BACKUP_DIR" -name "ecovale_hr_backup_*.sql*" -type f | sort -r)
    
    echo ""
    log "Total backups found: $count"
}

select_backup() {
    list_backups
    
    echo ""
    read -p "Enter backup filename (or 'latest' for most recent): " selection
    
    if [ "$selection" = "latest" ]; then
        BACKUP_FILE=$(find "$BACKUP_DIR" -name "ecovale_hr_backup_*.sql*" -type f | sort -r | head -1)
    else
        BACKUP_FILE="${BACKUP_DIR}/${selection}"
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log "Selected backup: $(basename "$BACKUP_FILE")"
}

create_safety_backup() {
    log "Creating safety backup of current database..."
    local safety_backup="${BACKUP_DIR}/safety_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
    
    mysqldump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --user="$DB_USER" \
        --password="$DB_PASSWORD" \
        --single-transaction \
        "$DB_NAME" | gzip > "$safety_backup"
    
    success "Safety backup created: $(basename "$safety_backup")"
}

perform_restore() {
    local backup_file="$1"
    
    log "Starting database restore..."
    log "Target database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
    
    # Check if backup is compressed
    if [[ "$backup_file" == *.gz ]]; then
        log "Decompressing and restoring..."
        gunzip -c "$backup_file" | mysql \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --user="$DB_USER" \
            --password="$DB_PASSWORD" \
            "$DB_NAME"
    else
        log "Restoring from uncompressed backup..."
        mysql \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --user="$DB_USER" \
            --password="$DB_PASSWORD" \
            "$DB_NAME" < "$backup_file"
    fi
    
    RESTORE_EXIT_CODE=$?
    
    if [ $RESTORE_EXIT_CODE -eq 0 ]; then
        success "Database restore completed successfully!"
        return 0
    else
        error "Database restore failed with exit code: $RESTORE_EXIT_CODE"
        return 1
    fi
}

# =================================================================
# MAIN SCRIPT
# =================================================================

echo ""
echo "=========================================="
echo "Ecovale HR Database Restore Utility"
echo "=========================================="
echo ""

# Check prerequisites
if ! command -v mysql &> /dev/null; then
    error "mysql command not found. Please install MySQL client tools."
    exit 1
fi

# Verify database connection
log "Verifying database connection..."
if ! mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" -e "SELECT 1;" &>/dev/null; then
    error "Cannot connect to database. Please check your credentials."
    exit 1
fi
success "Database connection successful"

# Select backup file
select_backup

# Display selected backup info
echo ""
log "Restore Configuration:"
echo "  Source: $(basename "$BACKUP_FILE")"
echo "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo "  Target Database: ${DB_NAME}@${DB_HOST}"
echo ""

# Safety warnings
warning "⚠️  WARNING: This will overwrite the current database!"
warning "⚠️  All existing data will be replaced with the backup."
echo ""

# Confirmation
if ! confirm "Do you want to proceed with the restore?"; then
    log "Restore cancelled by user"
    exit 0
fi

# Create safety backup
if confirm "Create a safety backup of the current database before restore?"; then
    create_safety_backup
else
    warning "Skipping safety backup (not recommended)"
fi

# Final confirmation
echo ""
warning "FINAL CONFIRMATION: This is your last chance to cancel!"
if ! confirm "Are you absolutely sure you want to restore the database?"; then
    log "Restore cancelled by user"
    exit 0
fi

# Perform restore
echo ""
perform_restore "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo ""
    success "=========================================="
    success "Database Restore Completed Successfully!"
    success "=========================================="
    echo ""
    log "Please verify that the application is working correctly."
    log "If there are issues, you can restore from the safety backup."
else
    echo ""
    error "=========================================="
    error "Database Restore Failed!"
    error "=========================================="
    echo ""
    error "The database may be in an inconsistent state."
    log "Consider restoring from the safety backup or contacting support."
    exit 1
fi

exit 0

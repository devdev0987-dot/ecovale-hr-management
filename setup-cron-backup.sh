#!/bin/bash
# =================================================================
# Setup Automated Cron Job for Database Backups
# =================================================================
# This script configures a cron job for automated daily backups
# =================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

echo ""
echo "=========================================="
echo "Ecovale HR - Automated Backup Setup"
echo "=========================================="
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-mysql.sh"

# Verify backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "Error: Backup script not found at $BACKUP_SCRIPT"
    exit 1
fi

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"
success "Backup script is executable"

# Prompt for cron schedule
echo ""
log "Select backup frequency:"
echo "  1. Daily at 2:00 AM"
echo "  2. Daily at midnight (12:00 AM)"
echo "  3. Every 6 hours"
echo "  4. Every 12 hours"
echo "  5. Custom schedule"
echo ""

read -p "Enter choice (1-5): " choice

case $choice in
    1)
        CRON_SCHEDULE="0 2 * * *"
        DESCRIPTION="Daily at 2:00 AM"
        ;;
    2)
        CRON_SCHEDULE="0 0 * * *"
        DESCRIPTION="Daily at midnight"
        ;;
    3)
        CRON_SCHEDULE="0 */6 * * *"
        DESCRIPTION="Every 6 hours"
        ;;
    4)
        CRON_SCHEDULE="0 */12 * * *"
        DESCRIPTION="Every 12 hours"
        ;;
    5)
        read -p "Enter custom cron schedule (e.g., '30 3 * * *'): " CRON_SCHEDULE
        DESCRIPTION="Custom: $CRON_SCHEDULE"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Create cron job entry
CRON_COMMENT="# Ecovale HR Database Backup - $DESCRIPTION"
CRON_JOB="$CRON_SCHEDULE cd $SCRIPT_DIR && ./backup-mysql.sh >> ${SCRIPT_DIR}/backup.log 2>&1"

log "Cron schedule: $DESCRIPTION"
log "Cron expression: $CRON_SCHEDULE"
log "Script location: $BACKUP_SCRIPT"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "backup-mysql.sh"; then
    warning "A backup cron job already exists!"
    read -p "Do you want to replace it? (yes/no): " replace
    if [ "$replace" != "yes" ]; then
        log "Setup cancelled"
        exit 0
    fi
    
    # Remove old cron job
    crontab -l 2>/dev/null | grep -v "backup-mysql.sh" | grep -v "Ecovale HR Database Backup" | crontab -
    success "Old cron job removed"
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_COMMENT"; echo "$CRON_JOB") | crontab -

success "Cron job installed successfully!"

# Display current crontab
echo ""
log "Current crontab entries:"
crontab -l 2>/dev/null | grep -A 1 "Ecovale HR" || echo "No Ecovale HR cron jobs found"

echo ""
success "=========================================="
success "Automated Backup Setup Complete!"
success "=========================================="
echo ""
log "Your database will be backed up automatically: $DESCRIPTION"
log "Backup logs will be written to: ${SCRIPT_DIR}/backup.log"
log ""
log "To view logs: tail -f ${SCRIPT_DIR}/backup.log"
log "To remove cron job: crontab -e (then delete the Ecovale HR lines)"
echo ""

exit 0

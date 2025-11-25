#!/bin/bash
# ECCS Database Backup Script
# This script backs up PostgreSQL and MongoDB databases

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# PostgreSQL Configuration
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-eccs_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-eccs_secure_password}"
POSTGRES_DATABASES=("eccs_email" "eccs_auth")

# MongoDB Configuration
MONGODB_URI="${MONGODB_URI:-mongodb://mongodb:27017}"
MONGODB_DATABASE="eccs_logs"

# Create backup directory
mkdir -p "$BACKUP_DIR/postgres" "$BACKUP_DIR/mongodb"

echo "Starting ECCS backup - $TIMESTAMP"

# Backup PostgreSQL databases
echo "Backing up PostgreSQL databases..."
for db in "${POSTGRES_DATABASES[@]}"; do
    backup_file="$BACKUP_DIR/postgres/${db}_${TIMESTAMP}.sql.gz"
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" "$db" | gzip > "$backup_file"
    echo "  Backed up $db to $backup_file"
done

# Backup MongoDB
echo "Backing up MongoDB..."
mongodump_file="$BACKUP_DIR/mongodb/eccs_logs_${TIMESTAMP}"
mongodump --uri="$MONGODB_URI" --db="$MONGODB_DATABASE" --out="$mongodump_file"
tar -czf "${mongodump_file}.tar.gz" -C "$BACKUP_DIR/mongodb" "eccs_logs_${TIMESTAMP}"
rm -rf "$mongodump_file"
echo "  Backed up MongoDB to ${mongodump_file}.tar.gz"

# Cleanup old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -type d -empty -delete

# Create backup manifest
manifest_file="$BACKUP_DIR/manifest_${TIMESTAMP}.json"
cat > "$manifest_file" << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -Iseconds)",
  "postgres_databases": $(printf '%s\n' "${POSTGRES_DATABASES[@]}" | jq -R . | jq -s .),
  "mongodb_database": "$MONGODB_DATABASE",
  "retention_days": $RETENTION_DAYS
}
EOF

echo "Backup complete! Manifest: $manifest_file"

# Optional: Upload to S3 or other cloud storage
if [ -n "$S3_BUCKET" ]; then
    echo "Uploading backups to S3..."
    aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/backups/$(date +%Y/%m/%d)/" --exclude "*.tmp"
    echo "Upload complete!"
fi

exit 0

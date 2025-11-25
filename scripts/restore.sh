#!/bin/bash
# ECCS Database Restore Script
# This script restores PostgreSQL and MongoDB databases from backups

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"

# Check if backup timestamp is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_timestamp>"
    echo "Available backups:"
    ls -1 "$BACKUP_DIR"/*.json 2>/dev/null | sed 's/.*manifest_//' | sed 's/.json//'
    exit 1
fi

TIMESTAMP="$1"

# PostgreSQL Configuration
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-eccs_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-eccs_secure_password}"
POSTGRES_DATABASES=("eccs_email" "eccs_auth")

# MongoDB Configuration
MONGODB_URI="${MONGODB_URI:-mongodb://mongodb:27017}"
MONGODB_DATABASE="eccs_logs"

echo "Starting ECCS restore from backup $TIMESTAMP"

# Confirm restore
read -p "This will overwrite existing data. Are you sure? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Restore PostgreSQL databases
echo "Restoring PostgreSQL databases..."
for db in "${POSTGRES_DATABASES[@]}"; do
    backup_file="$BACKUP_DIR/postgres/${db}_${TIMESTAMP}.sql.gz"
    if [ -f "$backup_file" ]; then
        echo "  Restoring $db from $backup_file"
        gunzip -c "$backup_file" | PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" "$db"
    else
        echo "  Warning: Backup file not found for $db"
    fi
done

# Restore MongoDB
echo "Restoring MongoDB..."
mongodump_file="$BACKUP_DIR/mongodb/eccs_logs_${TIMESTAMP}.tar.gz"
if [ -f "$mongodump_file" ]; then
    temp_dir=$(mktemp -d)
    tar -xzf "$mongodump_file" -C "$temp_dir"
    mongorestore --uri="$MONGODB_URI" --db="$MONGODB_DATABASE" --drop "$temp_dir/eccs_logs_${TIMESTAMP}/$MONGODB_DATABASE"
    rm -rf "$temp_dir"
    echo "  MongoDB restored successfully"
else
    echo "  Warning: MongoDB backup file not found"
fi

echo "Restore complete!"
exit 0

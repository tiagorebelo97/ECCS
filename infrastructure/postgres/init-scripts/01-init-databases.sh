#!/bin/bash
# ============================================================================
# ECCS PostgreSQL Initialization Script
# ============================================================================
# This script runs on first container startup to create databases and tables.
# It creates the eccs_auth and eccs_email databases with their schemas.
#
# EXECUTION ORDER:
#   - Scripts in /docker-entrypoint-initdb.d run alphabetically
#   - This is 01-init-databases.sh to run first
#
# DATABASES:
#   - eccs_auth: Authentication and user management
#   - eccs_email: Email records and templates
#
# SECURITY:
#   - Creates application-specific users (not superuser)
#   - Grants minimal required permissions
# ============================================================================

set -e  # Exit on any error

echo "=========================================="
echo "ECCS Database Initialization Starting..."
echo "=========================================="

# Function to create a database if it doesn't exist
create_database() {
    local db_name=$1
    echo "Creating database: $db_name"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT 'CREATE DATABASE $db_name'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db_name')\gexec
EOSQL
}

# Create the application databases
create_database "eccs_auth"
create_database "eccs_email"

echo "=========================================="
echo "Creating eccs_auth database schema..."
echo "=========================================="

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "eccs_auth" <<-EOSQL
    -- Users table for authentication
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
    );

    -- Index for faster email lookups during authentication
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;

    -- Refresh tokens for JWT rotation
    CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        revoked BOOLEAN DEFAULT false
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

    -- Audit log for security events
    CREATE TABLE IF NOT EXISTS auth_audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        success BOOLEAN NOT NULL,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON auth_audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON auth_audit_log(created_at);

    -- Function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    \$\$ language 'plpgsql';

    -- Trigger to auto-update updated_at
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EOSQL

echo "=========================================="
echo "Creating eccs_email database schema..."
echo "=========================================="

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "eccs_email" <<-EOSQL
    -- Email records table
    CREATE TABLE IF NOT EXISTS emails (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        body TEXT NOT NULL,
        html_body TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        priority INTEGER DEFAULT 5,
        scheduled_at TIMESTAMP WITH TIME ZONE,
        sent_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for common query patterns
    CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
    CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
    CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at);
    CREATE INDEX IF NOT EXISTS idx_emails_scheduled ON emails(scheduled_at) WHERE scheduled_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_emails_pending ON emails(status, priority) WHERE status = 'pending';

    -- Email templates table
    CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        subject_template VARCHAR(500) NOT NULL,
        body_template TEXT NOT NULL,
        html_template TEXT,
        variables JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_templates_name ON email_templates(name);
    CREATE INDEX IF NOT EXISTS idx_templates_active ON email_templates(is_active) WHERE is_active = true;

    -- Email attachments (metadata only, files stored externally)
    CREATE TABLE IF NOT EXISTS email_attachments (
        id SERIAL PRIMARY KEY,
        email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        size_bytes BIGINT NOT NULL,
        storage_path VARCHAR(500) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_email ON email_attachments(email_id);

    -- Function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    \$\$ language 'plpgsql';

    -- Triggers for auto-updating timestamps
    DROP TRIGGER IF EXISTS update_emails_updated_at ON emails;
    CREATE TRIGGER update_emails_updated_at
        BEFORE UPDATE ON emails
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_templates_updated_at ON email_templates;
    CREATE TRIGGER update_templates_updated_at
        BEFORE UPDATE ON email_templates
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EOSQL

echo "=========================================="
echo "ECCS Database Initialization Complete!"
echo "=========================================="
echo "Created databases:"
echo "  - eccs_auth (users, refresh_tokens, auth_audit_log)"
echo "  - eccs_email (emails, email_templates, email_attachments)"
echo "=========================================="

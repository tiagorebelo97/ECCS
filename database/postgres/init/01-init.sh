#!/bin/bash
# ============================================================================
# PostgreSQL Database Initialization Script
# ============================================================================
#
# This script initializes the ECCS PostgreSQL databases with required tables.
# It runs automatically on first container startup.
#
# DATABASES CREATED:
# - eccs_email: Email records, templates, and address book
# - eccs_auth: User accounts and authentication
# - eccs_locations: Saved map locations
#
# TABLES CREATED:
# - users: User accounts (eccs_auth)
# - emails: Email records (eccs_email)
# - email_addresses: Contact book entries (eccs_email)
# - email_templates: Reusable email templates (eccs_email)
# - locations: Saved map locations (eccs_locations)
#
# INDEXES:
# All tables include appropriate indexes for query performance.
#
# SECURITY:
# - Tables include user_id for row-level access control
# - Passwords stored as bcrypt hashes (handled by auth-service)
# ============================================================================

set -e

# Create databases and tables
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- ========================================================================
    -- CREATE DATABASES
    -- ========================================================================
    CREATE DATABASE eccs_email;
    CREATE DATABASE eccs_auth;
    CREATE DATABASE eccs_locations;
    
    -- ========================================================================
    -- GRANT PERMISSIONS
    -- ========================================================================
    -- Grant all privileges on the databases to eccs_user
    -- This ensures the user can connect and perform all operations
    GRANT ALL PRIVILEGES ON DATABASE eccs_email TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE eccs_auth TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE eccs_locations TO $POSTGRES_USER;
    
    -- ========================================================================
    -- AUTH DATABASE SCHEMA (eccs_auth)
    -- ========================================================================
    \c eccs_auth
    
    -- Grant schema permissions
    GRANT ALL ON SCHEMA public TO $POSTGRES_USER;
    
    -- Users table for authentication
    -- Stores user credentials and profile information
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,    -- bcrypt hashed
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Index for email lookups during login
    CREATE INDEX idx_users_email ON users(email);
    
    -- Grant table permissions
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $POSTGRES_USER;

    -- ========================================================================
    -- EMAIL DATABASE SCHEMA (eccs_email)
    -- ========================================================================
    \c eccs_email
    
    -- Grant schema permissions
    GRANT ALL ON SCHEMA public TO $POSTGRES_USER;
    
    -- ------------------------------------------------------------------------
    -- Emails Table
    -- ------------------------------------------------------------------------
    -- Stores email records created through the API
    -- Status is updated by notification-service after delivery attempt
    CREATE TABLE IF NOT EXISTS emails (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',  -- pending, sent, failed
        sent_at TIMESTAMP WITH TIME ZONE,      -- when successfully delivered
        error_message TEXT,                     -- error details if failed
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for common query patterns
    CREATE INDEX idx_emails_user_id ON emails(user_id);
    CREATE INDEX idx_emails_status ON emails(status);
    CREATE INDEX idx_emails_created_at ON emails(created_at);
    CREATE INDEX idx_emails_user_status ON emails(user_id, status);

    -- ------------------------------------------------------------------------
    -- Email Addresses Table (Contact Book)
    -- ------------------------------------------------------------------------
    -- Stores saved email addresses for quick recipient selection
    -- Each user has their own address book
    CREATE TABLE IF NOT EXISTS email_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(100),                     -- display name
        label VARCHAR(50),                     -- category (work, personal, etc.)
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        -- Prevent duplicate emails per user
        CONSTRAINT unique_user_email UNIQUE (user_id, email)
    );

    -- Indexes for address book queries
    CREATE INDEX idx_addresses_user_id ON email_addresses(user_id);
    CREATE INDEX idx_addresses_email ON email_addresses(email);
    CREATE INDEX idx_addresses_name ON email_addresses(name);
    CREATE INDEX idx_addresses_label ON email_addresses(label);

    -- ------------------------------------------------------------------------
    -- Email Templates Table
    -- ------------------------------------------------------------------------
    -- Stores reusable email templates with placeholder support
    -- Placeholders use {{variableName}} syntax
    CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,            -- template name
        subject VARCHAR(500) NOT NULL,         -- subject with placeholders
        html_content TEXT NOT NULL,            -- HTML body with placeholders
        text_content TEXT,                     -- plain text alternative
        description VARCHAR(500),              -- template description
        category VARCHAR(50),                  -- template category
        placeholders TEXT[],                   -- array of placeholder names
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        -- Prevent duplicate template names per user
        CONSTRAINT unique_user_template_name UNIQUE (user_id, name)
    );

    -- Indexes for template queries
    CREATE INDEX idx_templates_user_id ON email_templates(user_id);
    CREATE INDEX idx_templates_name ON email_templates(name);
    CREATE INDEX idx_templates_category ON email_templates(category);
    CREATE INDEX idx_templates_user_category ON email_templates(user_id, category);
    
    -- Grant table permissions
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $POSTGRES_USER;

    -- ========================================================================
    -- LOCATIONS DATABASE SCHEMA (eccs_locations)
    -- ========================================================================
    \c eccs_locations
    
    -- Grant schema permissions
    GRANT ALL ON SCHEMA public TO $POSTGRES_USER;
    
    -- ------------------------------------------------------------------------
    -- Locations Table
    -- ------------------------------------------------------------------------
    -- Stores saved map locations with coordinates and addresses
    -- Each user can save their own locations
    CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,            -- custom name for the location
        address TEXT,                           -- reverse geocoded or user-provided address
        latitude DECIMAL(10, 8) NOT NULL,       -- latitude coordinate
        longitude DECIMAL(11, 8) NOT NULL,      -- longitude coordinate
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for location queries
    CREATE INDEX idx_locations_user_id ON locations(user_id);
    CREATE INDEX idx_locations_name ON locations(name);
    CREATE INDEX idx_locations_created_at ON locations(created_at);
    
    -- Grant table permissions
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $POSTGRES_USER;
    
EOSQL

echo "Database initialization complete!"
echo "Created databases: eccs_auth, eccs_email, eccs_locations"
echo "Created tables: users, emails, email_addresses, email_templates, locations"

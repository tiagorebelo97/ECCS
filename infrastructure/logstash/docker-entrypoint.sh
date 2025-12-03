#!/bin/bash
# ============================================================================
# ECCS Logstash Custom Entrypoint
# ============================================================================
# This script ensures MongoDB has the required placeholder documents before
# starting Logstash. The logstash-input-mongodb plugin (v0.4.1) has a known
# bug where it crashes with "NoMethodError: undefined method [] for nil:NilClass"
# when trying to initialize placeholders on an empty collection.
#
# ROOT CAUSE:
#   The plugin's init_placeholder() function does:
#     first_entry = mongo_collection.find({}).sort(since_column => 1).limit(1).first
#     first_entry_id = first_entry[since_column].to_s  # CRASH if first_entry is nil
#   
#   This fails when the collection is empty because first_entry is nil.
#
# WORKAROUND:
#   This script waits for MongoDB to be ready and ensures the init scripts
#   have completed (which create placeholder documents in the collections).
#
# ENVIRONMENT VARIABLES:
#   MONGODB_URI: MongoDB connection string (default: mongodb://mongodb:27017/eccs_logs)
#   MONGODB_WAIT_TIMEOUT: Max seconds to wait for MongoDB (default: 300)
#   MONGODB_INIT_WAIT: Seconds to wait after MongoDB is reachable (default: 30)
#   SKIP_MONGODB_CHECK: Set to "true" to skip MongoDB readiness check
# ============================================================================

set -e

# Configuration
MONGODB_URI="${MONGODB_URI:-mongodb://mongodb:27017/eccs_logs}"
MONGODB_WAIT_TIMEOUT="${MONGODB_WAIT_TIMEOUT:-300}"
MONGODB_INIT_WAIT="${MONGODB_INIT_WAIT:-30}"
SKIP_MONGODB_CHECK="${SKIP_MONGODB_CHECK:-false}"

# Extract host, port, and database from MongoDB URI
# Format: mongodb://[host]:[port]/[database]
MONGO_HOST=$(echo "$MONGODB_URI" | sed -E 's|mongodb://([^:/]+)(:[0-9]+)?/.*|\1|')
MONGO_PORT=$(echo "$MONGODB_URI" | sed -E 's|mongodb://[^:/]+(:[0-9]+)?/.*|\1|' | tr -d ':')
MONGO_DB=$(echo "$MONGODB_URI" | sed -E 's|mongodb://[^/]+/([^?]+).*|\1|')

# Default port if not specified
MONGO_PORT="${MONGO_PORT:-27017}"

echo "=============================================="
echo "   ECCS Logstash Startup"
echo "=============================================="
echo "[INFO] MongoDB URI: $MONGODB_URI"
echo "[INFO] Extracted - Host: $MONGO_HOST, Port: $MONGO_PORT, DB: $MONGO_DB"

# Function to check if MongoDB is ready
check_mongodb_connectivity() {
    # Check TCP connectivity to MongoDB
    if command -v nc &> /dev/null; then
        nc -z "$MONGO_HOST" "$MONGO_PORT" 2>/dev/null
        return $?
    else
        # Fallback to bash's /dev/tcp
        timeout 2 bash -c "echo > /dev/tcp/$MONGO_HOST/$MONGO_PORT" 2>/dev/null
        return $?
    fi
}

# Function to check if MongoDB has placeholder documents using mongosh or Python
# This is more reliable than just checking TCP connectivity
check_mongodb_has_data() {
    # Try using Python with pymongo if available (Logstash has Python)
    if command -v python3 &> /dev/null; then
        python3 << EOF 2>/dev/null
import sys
try:
    from pymongo import MongoClient
    client = MongoClient("$MONGODB_URI", serverSelectionTimeoutMS=5000)
    db = client["$MONGO_DB"]
    
    # Check if email_logs has at least one document (more efficient than count_documents)
    email_doc = db.email_logs.find_one({})
    # Check if application_logs has at least one document  
    app_doc = db.application_logs.find_one({})
    
    if email_doc is not None and app_doc is not None:
        print("OK")
        sys.exit(0)
    else:
        sys.exit(1)
except Exception as e:
    sys.exit(1)
EOF
        return $?
    fi
    
    # If Python with pymongo is not available, fall back to TCP check
    return 1
}

# Skip MongoDB check if requested
if [ "$SKIP_MONGODB_CHECK" = "true" ]; then
    echo "[INFO] Skipping MongoDB readiness check (SKIP_MONGODB_CHECK=true)"
else
    echo "[INFO] Waiting for MongoDB to be ready (timeout: ${MONGODB_WAIT_TIMEOUT}s)..."
    
    elapsed=0
    mongodb_reachable=false
    
    # Phase 1: Wait for MongoDB to be reachable
    while [ $elapsed -lt $MONGODB_WAIT_TIMEOUT ]; do
        if check_mongodb_connectivity; then
            echo "[SUCCESS] MongoDB is reachable at $MONGO_HOST:$MONGO_PORT"
            mongodb_reachable=true
            break
        fi
        echo "[INFO] MongoDB not reachable yet, retrying in 5s... (${elapsed}s elapsed)"
        sleep 5
        elapsed=$((elapsed + 5))
    done
    
    if [ "$mongodb_reachable" = "false" ]; then
        echo "[WARNING] MongoDB connectivity check timed out after ${MONGODB_WAIT_TIMEOUT}s"
        echo "[WARNING] Continuing anyway - the mongodb pipeline may fail to start"
    else
        # Phase 2: Wait for MongoDB initialization scripts to complete
        # The init-mongo.js script creates collections and placeholder documents
        # This is critical because the logstash-input-mongodb plugin crashes
        # if it queries an empty collection
        echo "[INFO] Waiting ${MONGODB_INIT_WAIT}s for MongoDB initialization to complete..."
        echo "[INFO] (MongoDB init scripts create placeholder documents required by the mongodb input plugin)"
        sleep "$MONGODB_INIT_WAIT"
        
        # Phase 3: Verify placeholder documents exist (if pymongo is available)
        echo "[INFO] Checking if MongoDB has required placeholder documents..."
        data_check_attempts=0
        max_data_check_attempts=10
        
        while [ $data_check_attempts -lt $max_data_check_attempts ]; do
            if check_mongodb_has_data; then
                echo "[SUCCESS] MongoDB has placeholder documents in email_logs and application_logs"
                break
            fi
            data_check_attempts=$((data_check_attempts + 1))
            if [ $data_check_attempts -lt $max_data_check_attempts ]; then
                echo "[INFO] Placeholder documents not found yet, retrying... (attempt $data_check_attempts/$max_data_check_attempts)"
                sleep 5
            fi
        done
        
        if [ $data_check_attempts -ge $max_data_check_attempts ]; then
            echo "[WARNING] Could not verify placeholder documents exist"
            echo "[WARNING] This might be because pymongo is not installed, or documents don't exist yet"
            echo "[WARNING] Continuing anyway - the mongodb pipeline may fail if collections are empty"
        fi
    fi
fi

echo ""
echo "[INFO] Starting Logstash..."
echo "=============================================="

# Execute the original Logstash entrypoint
exec /usr/local/bin/docker-entrypoint "$@"

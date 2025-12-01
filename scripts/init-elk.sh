#!/bin/bash
# ============================================================================
# ECCS ELK Stack Initialization Script
# ============================================================================
# This script initializes the Elasticsearch/Kibana stack with:
# 1. Index Lifecycle Management (ILM) policies
# 2. Index templates for consistent field mappings
# 3. Kibana saved objects (index patterns, visualizations, dashboards)
#
# USAGE:
#   ./scripts/init-elk.sh
#   
#   To clean up and recreate indices with proper mappings:
#   CLEANUP_INDICES=true ./scripts/init-elk.sh
#
# PREREQUISITES:
#   - Elasticsearch running at http://localhost:9200 (or $ELASTICSEARCH_HOST)
#   - Kibana running at http://localhost:5601 (or $KIBANA_HOST)
#
# ENVIRONMENT VARIABLES:
#   - ELASTICSEARCH_HOST: Elasticsearch URL (default: http://localhost:9200)
#   - KIBANA_HOST: Kibana URL (default: http://localhost:5601)
#   - CLEANUP_INDICES: Set to 'true' to delete existing indices before setup
#
# This script is idempotent and safe to run multiple times.
# ============================================================================

set -e

# Configuration with defaults
ELASTICSEARCH_HOST="${ELASTICSEARCH_HOST:-http://localhost:9200}"
KIBANA_HOST="${KIBANA_HOST:-http://localhost:5601}"
MAX_RETRIES=60
RETRY_INTERVAL=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Wait for Elasticsearch to be ready
wait_for_elasticsearch() {
    log_info "Waiting for Elasticsearch at $ELASTICSEARCH_HOST..."
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -s "$ELASTICSEARCH_HOST/_cluster/health" | grep -q '"status"'; then
            local status=$(curl -s "$ELASTICSEARCH_HOST/_cluster/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            if [ "$status" = "green" ] || [ "$status" = "yellow" ]; then
                log_success "Elasticsearch is ready (status: $status)"
                return 0
            fi
        fi
        retries=$((retries + 1))
        log_info "Attempt $retries/$MAX_RETRIES - Elasticsearch not ready yet..."
        sleep $RETRY_INTERVAL
    done
    
    log_error "Elasticsearch did not become ready in time"
    return 1
}

# Wait for Kibana to be ready
wait_for_kibana() {
    log_info "Waiting for Kibana at $KIBANA_HOST..."
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -s "$KIBANA_HOST/api/status" | grep -q '"level":"available"'; then
            log_success "Kibana is ready"
            return 0
        fi
        retries=$((retries + 1))
        log_info "Attempt $retries/$MAX_RETRIES - Kibana not ready yet..."
        sleep $RETRY_INTERVAL
    done
    
    log_error "Kibana did not become ready in time"
    return 1
}

# Clean up existing indices with bad mappings (optional)
cleanup_indices() {
    if [ "$CLEANUP_INDICES" = "true" ]; then
        log_warn "Cleaning up existing indices with potentially bad mappings..."
        curl -s -X DELETE "$ELASTICSEARCH_HOST/eccs-logs-*" > /dev/null 2>&1 || true
        curl -s -X DELETE "$ELASTICSEARCH_HOST/eccs-email-logs-*" > /dev/null 2>&1 || true
        curl -s -X DELETE "$ELASTICSEARCH_HOST/eccs-app-logs-*" > /dev/null 2>&1 || true
        log_success "Cleanup complete"
    fi
}

# Create ILM policy for log retention
create_ilm_policy() {
    log_info "Creating ILM policy 'eccs-logs-policy'..."
    
    curl -s -X PUT "$ELASTICSEARCH_HOST/_ilm/policy/eccs-logs-policy" \
        -H "Content-Type: application/json" \
        -d '{
            "policy": {
                "phases": {
                    "hot": {
                        "min_age": "0ms",
                        "actions": {
                            "rollover": {
                                "max_primary_shard_size": "50gb",
                                "max_age": "30d"
                            }
                        }
                    },
                    "warm": {
                        "min_age": "30d",
                        "actions": {
                            "shrink": {
                                "number_of_shards": 1
                            },
                            "forcemerge": {
                                "max_num_segments": 1
                            }
                        }
                    },
                    "delete": {
                        "min_age": "90d",
                        "actions": {
                            "delete": {}
                        }
                    }
                }
            }
        }' > /dev/null
    
    log_success "ILM policy created"
}

# Create index template
create_index_template() {
    log_info "Creating index template 'eccs-logs-template'..."
    
    # Get the template file path
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    TEMPLATE_FILE="$SCRIPT_DIR/../infrastructure/elasticsearch/templates/eccs-logs-template.json"
    
    if [ -f "$TEMPLATE_FILE" ]; then
        # Remove JSON comment fields (lines containing "_comment") using sed
        # This is more robust than simple grep as it preserves JSON structure
        local template_content=$(sed '/"_comment/d' "$TEMPLATE_FILE" | tr -d '\n')
        
        curl -s -X PUT "$ELASTICSEARCH_HOST/_index_template/eccs-logs-template" \
            -H "Content-Type: application/json" \
            -d "$template_content" > /dev/null
        
        log_success "Index template created from file"
    else
        # Fallback: create a basic template
        curl -s -X PUT "$ELASTICSEARCH_HOST/_index_template/eccs-logs-template" \
            -H "Content-Type: application/json" \
            -d '{
                "index_patterns": ["eccs-logs-*", "eccs-email-logs-*", "eccs-app-logs-*"],
                "priority": 100,
                "template": {
                    "settings": {
                        "number_of_shards": 1,
                        "number_of_replicas": 0,
                        "refresh_interval": "5s",
                        "index.lifecycle.name": "eccs-logs-policy"
                    },
                    "mappings": {
                        "dynamic": "true",
                        "properties": {
                            "@timestamp": { "type": "date" },
                            "level": { "type": "keyword" },
                            "service": { "type": "keyword" },
                            "message": { "type": "text" },
                            "status": { "type": "keyword" },
                            "latencyMs": { "type": "long" },
                            "error_category": { "type": "keyword" },
                            "is_retry": { "type": "boolean" },
                            "sentToDlq": { "type": "boolean" },
                            "attempt": { "type": "integer" }
                        }
                    }
                }
            }' > /dev/null
        
        log_success "Index template created (using defaults)"
    fi
}

# Create initial indices with rollover aliases
create_initial_indices() {
    log_info "Creating initial indices with rollover aliases..."
    
    # Create eccs-logs index alias
    if ! curl -s "$ELASTICSEARCH_HOST/eccs-logs-000001" | grep -q '"eccs-logs-000001"'; then
        curl -s -X PUT "$ELASTICSEARCH_HOST/eccs-logs-000001" \
            -H "Content-Type: application/json" \
            -d '{
                "aliases": {
                    "eccs-logs": {
                        "is_write_index": true
                    }
                }
            }' > /dev/null
        log_success "Created eccs-logs-000001 with alias"
    else
        log_info "Index eccs-logs-000001 already exists"
    fi
    
    # Create eccs-email-logs index alias
    if ! curl -s "$ELASTICSEARCH_HOST/eccs-email-logs-000001" | grep -q '"eccs-email-logs-000001"'; then
        curl -s -X PUT "$ELASTICSEARCH_HOST/eccs-email-logs-000001" \
            -H "Content-Type: application/json" \
            -d '{
                "aliases": {
                    "eccs-email-logs": {
                        "is_write_index": true
                    }
                }
            }' > /dev/null
        log_success "Created eccs-email-logs-000001 with alias"
    else
        log_info "Index eccs-email-logs-000001 already exists"
    fi
    
    # Create eccs-app-logs index alias
    if ! curl -s "$ELASTICSEARCH_HOST/eccs-app-logs-000001" | grep -q '"eccs-app-logs-000001"'; then
        curl -s -X PUT "$ELASTICSEARCH_HOST/eccs-app-logs-000001" \
            -H "Content-Type: application/json" \
            -d '{
                "aliases": {
                    "eccs-app-logs": {
                        "is_write_index": true
                    }
                }
            }' > /dev/null
        log_success "Created eccs-app-logs-000001 with alias"
    else
        log_info "Index eccs-app-logs-000001 already exists"
    fi
}

# Import Kibana saved objects
import_kibana_objects() {
    log_info "Importing Kibana saved objects..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SAVED_OBJECTS_DIR="$SCRIPT_DIR/../infrastructure/kibana/saved-objects"
    
    # Import index patterns first
    if [ -f "$SAVED_OBJECTS_DIR/index-patterns.ndjson" ]; then
        log_info "Importing index patterns..."
        curl -s -X POST "$KIBANA_HOST/api/saved_objects/_import?overwrite=true" \
            -H "kbn-xsrf: true" \
            -F "file=@$SAVED_OBJECTS_DIR/index-patterns.ndjson" > /dev/null
        log_success "Index patterns imported"
    else
        log_warn "index-patterns.ndjson not found"
    fi
    
    # Import dashboards and visualizations
    if [ -f "$SAVED_OBJECTS_DIR/email-dashboards.ndjson" ]; then
        log_info "Importing dashboards and visualizations..."
        curl -s -X POST "$KIBANA_HOST/api/saved_objects/_import?overwrite=true" \
            -H "kbn-xsrf: true" \
            -F "file=@$SAVED_OBJECTS_DIR/email-dashboards.ndjson" > /dev/null
        log_success "Dashboards imported"
    else
        log_warn "email-dashboards.ndjson not found"
    fi
}

# Create default data view in Kibana
create_default_data_view() {
    log_info "Setting default data view..."
    
    # Get the first data view
    local data_views=$(curl -s "$KIBANA_HOST/api/data_views" -H "kbn-xsrf: true")
    
    if echo "$data_views" | grep -q "eccs-logs"; then
        log_success "Default data view configured"
    else
        log_info "Data views will be available after first log ingestion"
    fi
}

# Main execution
main() {
    echo ""
    echo "=============================================="
    echo "   ECCS ELK Stack Initialization"
    echo "=============================================="
    echo ""
    
    # Wait for services
    wait_for_elasticsearch || exit 1
    wait_for_kibana || exit 1
    
    echo ""
    log_info "Initializing Elasticsearch..."
    
    # Optional cleanup of existing indices
    cleanup_indices
    
    # Create Elasticsearch resources
    create_ilm_policy
    create_index_template
    create_initial_indices
    
    echo ""
    log_info "Initializing Kibana..."
    
    # Import Kibana objects
    import_kibana_objects
    create_default_data_view
    
    echo ""
    echo "=============================================="
    log_success "ELK Stack initialization complete!"
    echo "=============================================="
    echo ""
    echo "Access Kibana at: $KIBANA_HOST"
    echo ""
    echo "Available dashboards:"
    echo "  - [ECCS] Email Processing Dashboard"
    echo ""
    echo "Useful Kibana filters:"
    echo "  - service:email-service (email service logs)"
    echo "  - service:auth-service (authentication logs)"
    echo "  - service:notification-service (email processing)"
    echo "  - level:error (errors only)"
    echo "  - status:failed OR status:retry (failed emails)"
    echo "  - latencyMs:[5000 TO *] (slow processing)"
    echo ""
}

# Run main
main "$@"

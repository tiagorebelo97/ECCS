#!/bin/bash
# ============================================================================
# ECCS Platform Stop Script
# ============================================================================
# This script stops all ECCS services gracefully.
# It supports both Podman and Docker container runtimes.
#
# USAGE:
#   ./stop.sh              # Stop all services (keep volumes)
#   ./stop.sh --clean      # Stop and remove volumes (DATA LOSS!)
#   ./stop.sh [service]    # Stop specific service
#   ./stop.sh --help       # Show help message
#
# SHUTDOWN ORDER:
#   1. Frontend and API gateway
#   2. Backend services
#   3. Observability stack
#   4. Infrastructure (databases, message queue)
#
# OPTIONS:
#   --clean       Remove volumes (WARNING: deletes all data!)
#   --remove      Remove containers after stopping
#   --timeout N   Seconds to wait for graceful shutdown (default: 30)
# ============================================================================

set -e

# ============================================================================
# Configuration
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/podman-compose.yml"

# Default settings
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-eccs}"
SHUTDOWN_TIMEOUT="${SHUTDOWN_TIMEOUT:-30}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
ECCS Platform Stop Script

Usage: $0 [OPTIONS] [SERVICE...]

Options:
  --clean             Remove all volumes (WARNING: DATA LOSS!)
  --remove            Remove containers after stopping
  --timeout N         Graceful shutdown timeout in seconds (default: 30)
  --force             Force stop (SIGKILL) if graceful stop fails
  -v, --verbose       Verbose output
  -h, --help          Show this help message

Services:
  If no services specified, all services are stopped.
  Available services: frontend, traefik, email-service, auth-service,
                      notification-service, postgres, mongodb, kafka,
                      zookeeper, elasticsearch, logstash, kibana,
                      grafana, prometheus, jaeger

Examples:
  $0                  # Stop all services gracefully
  $0 --clean          # Stop all and remove volumes (DATA LOSS!)
  $0 email-service    # Stop only email-service
  $0 --timeout 60     # Wait 60 seconds for graceful shutdown

WARNING:
  Using --clean will DELETE ALL DATA including:
  - PostgreSQL databases (users, emails)
  - MongoDB collections (logs, audit)
  - Elasticsearch indices (log data)
  - Grafana dashboards and settings

EOF
}

# Detect container runtime
detect_runtime() {
    if command -v podman &> /dev/null && command -v podman-compose &> /dev/null; then
        CONTAINER_RUNTIME="podman"
        COMPOSE_CMD="podman-compose"
        CONTAINER_CMD="podman"
    elif command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        CONTAINER_RUNTIME="docker"
        COMPOSE_CMD="docker-compose"
        CONTAINER_CMD="docker"
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        CONTAINER_RUNTIME="docker"
        COMPOSE_CMD="docker compose"
        CONTAINER_CMD="docker"
    else
        log_error "No container runtime found."
        exit 1
    fi
}

# Stop specific services
stop_services() {
    local services="$@"
    
    log_info "Stopping services: $services"
    $COMPOSE_CMD -f "$COMPOSE_FILE" stop -t "$SHUTDOWN_TIMEOUT" $services
    
    if [ "$REMOVE_CONTAINERS" = "true" ]; then
        log_info "Removing containers..."
        $COMPOSE_CMD -f "$COMPOSE_FILE" rm -f $services
    fi
}

# Stop all services in reverse dependency order
stop_all() {
    log_info "Stopping all ECCS services..."
    
    # Stop frontend and gateway first
    log_info "Stopping frontend and API gateway..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" stop -t "$SHUTDOWN_TIMEOUT" \
        frontend traefik 2>/dev/null || true
    
    # Stop backend services
    log_info "Stopping backend services..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" stop -t "$SHUTDOWN_TIMEOUT" \
        email-service auth-service notification-service 2>/dev/null || true
    
    # Stop observability stack
    log_info "Stopping observability stack..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" stop -t "$SHUTDOWN_TIMEOUT" \
        kibana logstash grafana prometheus jaeger 2>/dev/null || true
    
    # Stop infrastructure
    log_info "Stopping infrastructure..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" stop -t "$SHUTDOWN_TIMEOUT" \
        kafka zookeeper elasticsearch mongodb postgres 2>/dev/null || true
    
    log_success "All services stopped"
}

# Remove all containers
remove_containers() {
    log_info "Removing containers..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" rm -f
    log_success "Containers removed"
}

# Remove volumes (DATA LOSS!)
remove_volumes() {
    log_warning "This will DELETE ALL DATA including:"
    echo "  - PostgreSQL databases (users, emails)"
    echo "  - MongoDB collections (logs, audit)"
    echo "  - Elasticsearch indices (log data)"
    echo "  - Grafana dashboards and settings"
    echo "  - Kafka topics and messages"
    echo ""
    
    read -p "Are you SURE you want to delete all data? Type 'yes' to confirm: " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Volume removal cancelled"
        return
    fi
    
    log_warning "Removing volumes..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" down -v
    
    # Remove named volumes if any remain
    log_info "Cleaning up named volumes..."
    $CONTAINER_CMD volume rm \
        eccs_postgres_data \
        eccs_mongodb_data \
        eccs_elasticsearch_data \
        eccs_kafka_data \
        eccs_zookeeper_data \
        eccs_zookeeper_log \
        eccs_grafana_data \
        eccs_prometheus_data \
        2>/dev/null || true
    
    log_success "All volumes removed"
}

# Force stop all containers
force_stop() {
    log_warning "Force stopping all containers..."
    
    # Get all container IDs for the project
    local containers=$($CONTAINER_CMD ps -q --filter "name=$COMPOSE_PROJECT_NAME" 2>/dev/null)
    
    if [ -n "$containers" ]; then
        $CONTAINER_CMD kill $containers 2>/dev/null || true
        $CONTAINER_CMD rm -f $containers 2>/dev/null || true
    fi
    
    log_success "Containers force stopped"
}

# ============================================================================
# Main Script
# ============================================================================

# Parse command line arguments
CLEAN=""
REMOVE_CONTAINERS=""
FORCE=""
VERBOSE=""
SERVICES=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN="true"
            shift
            ;;
        --remove)
            REMOVE_CONTAINERS="true"
            shift
            ;;
        --timeout)
            SHUTDOWN_TIMEOUT="$2"
            shift 2
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        -v|--verbose)
            VERBOSE="true"
            set -x
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            SERVICES="$SERVICES $1"
            shift
            ;;
    esac
done

# Main execution
echo ""
echo "============================================"
echo "ECCS Platform Shutdown"
echo "============================================"
echo ""

detect_runtime
cd "$PROJECT_ROOT"

if [ -n "$SERVICES" ]; then
    # Stop specific services
    stop_services $SERVICES
elif [ "$FORCE" = "true" ]; then
    # Force stop all
    force_stop
elif [ "$CLEAN" = "true" ]; then
    # Stop all and remove volumes
    stop_all
    remove_containers
    remove_volumes
else
    # Stop all services
    stop_all
    
    if [ "$REMOVE_CONTAINERS" = "true" ]; then
        remove_containers
    fi
fi

echo ""
echo "============================================"
echo "ECCS Platform Stopped"
echo "============================================"

exit 0

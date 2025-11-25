#!/bin/bash
# ============================================================================
# ECCS Platform Logs Script
# ============================================================================
# This script provides easy access to service logs with filtering options.
#
# USAGE:
#   ./logs.sh                  # Show logs from all services
#   ./logs.sh [service]        # Show logs from specific service
#   ./logs.sh -f [service]     # Follow (tail) logs
#   ./logs.sh --help           # Show help message
#
# OPTIONS:
#   -f, --follow      Follow log output (live)
#   -n, --lines N     Show last N lines (default: 100)
#   --since TIME      Show logs since timestamp (e.g., "1h", "2023-01-01")
#   --until TIME      Show logs until timestamp
#   --errors          Filter for error-level logs only
#   --json            Output in JSON format
# ============================================================================

set -e

# ============================================================================
# Configuration
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/podman-compose.yml"

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-eccs}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# Helper Functions
# ============================================================================

show_help() {
    cat << EOF
ECCS Platform Logs Script

Usage: $0 [OPTIONS] [SERVICE...]

Options:
  -f, --follow        Follow log output (live tail)
  -n, --lines N       Show last N lines (default: 100)
  --since TIME        Show logs since timestamp (e.g., "1h", "2023-01-01T10:00:00")
  --until TIME        Show logs until timestamp
  --errors            Filter for error-level logs only
  --timestamps        Show timestamps
  --no-color          Disable colored output
  -h, --help          Show this help message

Services:
  frontend, traefik, email-service, auth-service, notification-service,
  postgres, mongodb, kafka, zookeeper, elasticsearch, logstash, kibana,
  grafana, prometheus, jaeger

Examples:
  $0                      # Show all logs (last 100 lines)
  $0 email-service        # Show email-service logs
  $0 -f email-service     # Follow email-service logs
  $0 --since 1h           # Show logs from last hour
  $0 --errors             # Show only errors

Tips:
  - Use Ctrl+C to stop following logs
  - Combine services: $0 email-service auth-service
  - Use grep for filtering: $0 email-service | grep "error"

EOF
}

# Detect container runtime
detect_runtime() {
    if command -v podman &> /dev/null && command -v podman-compose &> /dev/null; then
        COMPOSE_CMD="podman-compose"
        CONTAINER_CMD="podman"
    elif command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        CONTAINER_CMD="docker"
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        CONTAINER_CMD="docker"
    else
        echo "No container runtime found."
        exit 1
    fi
}

# Format log output with colors
format_logs() {
    local service=$1
    local color
    
    case $service in
        frontend)      color="$CYAN" ;;
        traefik)       color="$BLUE" ;;
        email*)        color="$GREEN" ;;
        auth*)         color="$YELLOW" ;;
        notification*) color="$MAGENTA" ;;
        postgres)      color="$BLUE" ;;
        mongodb)       color="$GREEN" ;;
        kafka*)        color="$YELLOW" ;;
        elastic*)      color="$CYAN" ;;
        *)             color="$NC" ;;
    esac
    
    while IFS= read -r line; do
        echo -e "${color}[$service]${NC} $line"
    done
}

# Filter error logs
filter_errors() {
    grep -iE "(error|fail|exception|critical|fatal)" --color=auto
}

# Show logs for a service
show_logs() {
    local service=$1
    local container="$COMPOSE_PROJECT_NAME-$service"
    
    # Check if container exists
    if ! $CONTAINER_CMD ps -a --format "{{.Names}}" | grep -q "^$container$"; then
        echo -e "${RED}Error: Container '$container' not found${NC}"
        return 1
    fi
    
    local cmd="$CONTAINER_CMD logs"
    
    # Add options
    [ -n "$FOLLOW" ] && cmd="$cmd -f"
    [ -n "$LINES" ] && cmd="$cmd --tail $LINES"
    [ -n "$SINCE" ] && cmd="$cmd --since $SINCE"
    [ -n "$UNTIL" ] && cmd="$cmd --until $UNTIL"
    [ -n "$TIMESTAMPS" ] && cmd="$cmd -t"
    
    # Execute
    if [ -n "$FILTER_ERRORS" ]; then
        $cmd "$container" 2>&1 | filter_errors
    elif [ -n "$NO_COLOR" ]; then
        $cmd "$container" 2>&1
    else
        $cmd "$container" 2>&1 | format_logs "$service"
    fi
}

# Show all logs
show_all_logs() {
    echo -e "${BLUE}Showing logs from all ECCS services...${NC}"
    echo ""
    
    local cmd="$COMPOSE_CMD -f $COMPOSE_FILE logs"
    
    [ -n "$FOLLOW" ] && cmd="$cmd -f"
    [ -n "$LINES" ] && cmd="$cmd --tail $LINES"
    [ -n "$TIMESTAMPS" ] && cmd="$cmd -t"
    
    if [ -n "$FILTER_ERRORS" ]; then
        $cmd 2>&1 | filter_errors
    else
        $cmd 2>&1
    fi
}

# ============================================================================
# Main Script
# ============================================================================

# Parse arguments
FOLLOW=""
LINES="100"
SINCE=""
UNTIL=""
TIMESTAMPS=""
FILTER_ERRORS=""
NO_COLOR=""
SERVICES=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW="true"
            shift
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        --since)
            SINCE="$2"
            shift 2
            ;;
        --until)
            UNTIL="$2"
            shift 2
            ;;
        --timestamps)
            TIMESTAMPS="true"
            shift
            ;;
        --errors)
            FILTER_ERRORS="true"
            shift
            ;;
        --no-color)
            NO_COLOR="true"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            SERVICES="$SERVICES $1"
            shift
            ;;
    esac
done

detect_runtime
cd "$PROJECT_ROOT"

if [ -z "$SERVICES" ]; then
    show_all_logs
else
    for service in $SERVICES; do
        show_logs "$service"
    done
fi

exit 0

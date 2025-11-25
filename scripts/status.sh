#!/bin/bash
# ============================================================================
# ECCS Platform Status Script
# ============================================================================
# This script shows the status of all ECCS services including:
# - Container status (running, stopped, unhealthy)
# - Health check results
# - Resource usage (CPU, memory)
# - Port mappings
#
# USAGE:
#   ./status.sh              # Show all service status
#   ./status.sh -w           # Watch mode (updates every 2 seconds)
#   ./status.sh [service]    # Show status of specific service
#   ./status.sh --help       # Show help message
#
# OUTPUT:
#   Shows a table with service name, status, health, ports, and resources.
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
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# Helper Functions
# ============================================================================

show_help() {
    cat << EOF
ECCS Platform Status Script

Usage: $0 [OPTIONS] [SERVICE...]

Options:
  -w, --watch         Watch mode (updates every 2 seconds)
  -a, --all           Show all containers (including stopped)
  --health            Show detailed health check info
  --ports             Show detailed port mappings
  --logs              Show recent logs for each service
  -h, --help          Show this help message

Examples:
  $0                  # Show status of all services
  $0 -w               # Watch mode with auto-refresh
  $0 postgres         # Show PostgreSQL status
  $0 --health         # Show health check details

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

# Get status color
get_status_color() {
    local status=$1
    case $status in
        running*|Up*)
            echo -e "${GREEN}$status${NC}"
            ;;
        exited*|Exit*)
            echo -e "${RED}$status${NC}"
            ;;
        starting*|created*)
            echo -e "${YELLOW}$status${NC}"
            ;;
        *)
            echo -e "$status"
            ;;
    esac
}

# Get health color
get_health_color() {
    local health=$1
    case $health in
        healthy)
            echo -e "${GREEN}●${NC} healthy"
            ;;
        unhealthy)
            echo -e "${RED}●${NC} unhealthy"
            ;;
        starting)
            echo -e "${YELLOW}●${NC} starting"
            ;;
        *)
            echo -e "○ none"
            ;;
    esac
}

# Show service overview
show_overview() {
    echo ""
    echo "============================================"
    echo "ECCS Platform Status"
    echo "============================================"
    echo "Runtime: $CONTAINER_CMD"
    echo "Compose: $COMPOSE_CMD"
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Count containers by status
    local total=$($CONTAINER_CMD ps -a --filter "name=$COMPOSE_PROJECT_NAME" --format "{{.Names}}" 2>/dev/null | wc -l)
    local running=$($CONTAINER_CMD ps --filter "name=$COMPOSE_PROJECT_NAME" --format "{{.Names}}" 2>/dev/null | wc -l)
    local stopped=$((total - running))
    
    echo "Containers: ${GREEN}$running running${NC}, ${RED}$stopped stopped${NC}, $total total"
    echo ""
}

# Show container table
show_container_table() {
    local show_all=$1
    
    printf "%-25s %-15s %-15s %-25s %-10s\n" "SERVICE" "STATUS" "HEALTH" "PORTS" "CPU/MEM"
    printf "%s\n" "─────────────────────────────────────────────────────────────────────────────────────────"
    
    local containers
    if [ "$show_all" = "true" ]; then
        containers=$($CONTAINER_CMD ps -a --filter "name=$COMPOSE_PROJECT_NAME" --format "{{.Names}}")
    else
        containers=$($CONTAINER_CMD ps --filter "name=$COMPOSE_PROJECT_NAME" --format "{{.Names}}")
    fi
    
    for container in $containers; do
        # Get container details
        local status=$($CONTAINER_CMD inspect --format '{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
        local health=$($CONTAINER_CMD inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo "none")
        local ports=$($CONTAINER_CMD port "$container" 2>/dev/null | head -1 || echo "-")
        
        # Get resource stats (if running)
        local stats="-"
        if [ "$status" = "running" ]; then
            stats=$($CONTAINER_CMD stats --no-stream --format "{{.CPUPerc}}/{{.MemUsage}}" "$container" 2>/dev/null | cut -d'/' -f1-2 || echo "-")
        fi
        
        # Format service name (remove project prefix)
        local service=${container#"$COMPOSE_PROJECT_NAME-"}
        
        # Print row with colors
        printf "%-25s " "$service"
        printf "%-15s " "$(get_status_color "$status")"
        printf "%-15s " "$(get_health_color "$health")"
        printf "%-25s " "${ports:-"-"}"
        printf "%-10s\n" "$stats"
    done
}

# Show health check details
show_health_details() {
    echo ""
    echo "============================================"
    echo "Health Check Details"
    echo "============================================"
    
    local containers=$($CONTAINER_CMD ps --filter "name=$COMPOSE_PROJECT_NAME" --format "{{.Names}}")
    
    for container in $containers; do
        local health_status=$($CONTAINER_CMD inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null)
        
        if [ -n "$health_status" ]; then
            echo ""
            echo "Container: $container"
            echo "Status: $health_status"
            
            # Get last health check log
            local last_log=$($CONTAINER_CMD inspect --format '{{if .State.Health}}{{range $i, $e := .State.Health.Log}}{{if eq $i 0}}Exit: {{$e.ExitCode}}, Output: {{$e.Output}}{{end}}{{end}}{{end}}' "$container" 2>/dev/null)
            
            if [ -n "$last_log" ]; then
                echo "Last Check: $last_log"
            fi
        fi
    done
}

# Show port mappings
show_port_details() {
    echo ""
    echo "============================================"
    echo "Port Mappings"
    echo "============================================"
    printf "%-25s %-15s %-30s\n" "SERVICE" "CONTAINER" "HOST → CONTAINER"
    printf "%s\n" "─────────────────────────────────────────────────────────────────"
    
    local containers=$($CONTAINER_CMD ps --filter "name=$COMPOSE_PROJECT_NAME" --format "{{.Names}}")
    
    for container in $containers; do
        local service=${container#"$COMPOSE_PROJECT_NAME-"}
        local ports=$($CONTAINER_CMD port "$container" 2>/dev/null)
        
        if [ -n "$ports" ]; then
            while IFS= read -r port; do
                printf "%-25s %-15s %-30s\n" "$service" "${port%% ->*}" "${port#*-> }"
            done <<< "$ports"
        fi
    done
}

# Show recent logs
show_logs() {
    local service=$1
    local lines=${2:-10}
    
    echo ""
    echo "============================================"
    echo "Recent Logs: $service"
    echo "============================================"
    
    $CONTAINER_CMD logs --tail "$lines" "$COMPOSE_PROJECT_NAME-$service" 2>&1
}

# Watch mode
watch_mode() {
    while true; do
        clear
        show_overview
        show_container_table "$SHOW_ALL"
        echo ""
        echo "Press Ctrl+C to exit. Refreshing every 2 seconds..."
        sleep 2
    done
}

# ============================================================================
# Main Script
# ============================================================================

# Parse arguments
WATCH=""
SHOW_ALL=""
SHOW_HEALTH=""
SHOW_PORTS=""
SHOW_LOGS=""
SERVICES=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -w|--watch)
            WATCH="true"
            shift
            ;;
        -a|--all)
            SHOW_ALL="true"
            shift
            ;;
        --health)
            SHOW_HEALTH="true"
            shift
            ;;
        --ports)
            SHOW_PORTS="true"
            shift
            ;;
        --logs)
            SHOW_LOGS="true"
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

if [ "$WATCH" = "true" ]; then
    watch_mode
else
    show_overview
    show_container_table "$SHOW_ALL"
    
    if [ "$SHOW_HEALTH" = "true" ]; then
        show_health_details
    fi
    
    if [ "$SHOW_PORTS" = "true" ]; then
        show_port_details
    fi
    
    if [ "$SHOW_LOGS" = "true" ] && [ -n "$SERVICES" ]; then
        for service in $SERVICES; do
            show_logs "$service"
        done
    fi
fi

exit 0

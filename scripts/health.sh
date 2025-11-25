#!/bin/bash
# ============================================================================
# ECCS Platform Health Check Script
# ============================================================================
# This script performs comprehensive health checks on all ECCS services.
# It verifies service availability, database connectivity, and message queue status.
#
# USAGE:
#   ./health.sh              # Run all health checks
#   ./health.sh [service]    # Check specific service
#   ./health.sh --watch      # Continuous monitoring
#   ./health.sh --help       # Show help message
#
# CHECKS PERFORMED:
#   - Container status (running/stopped)
#   - Health endpoint responses
#   - Database connectivity
#   - Message queue connectivity
#   - Port accessibility
# ============================================================================

set -e

# ============================================================================
# Configuration
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/podman-compose.yml"

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-eccs}"
CHECK_TIMEOUT="${CHECK_TIMEOUT:-5}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Helper Functions
# ============================================================================

show_help() {
    cat << EOF
ECCS Platform Health Check Script

Usage: $0 [OPTIONS] [SERVICE...]

Options:
  --watch             Continuous monitoring (updates every 30s)
  --json              Output results in JSON format
  --verbose           Show detailed check output
  --timeout N         Check timeout in seconds (default: 5)
  -h, --help          Show this help message

Health Checks:
  - Container status (is container running?)
  - Health endpoint (does /health respond?)
  - Database connectivity (can connect to DB?)
  - Port accessibility (is port open?)

Exit Codes:
  0 - All checks passed
  1 - One or more checks failed
  2 - Script error

Examples:
  $0                  # Run all health checks
  $0 postgres         # Check PostgreSQL only
  $0 --watch          # Continuous monitoring
  $0 --json           # JSON output for scripting

EOF
}

# Detect container runtime
detect_runtime() {
    if command -v podman &> /dev/null; then
        CONTAINER_CMD="podman"
    elif command -v docker &> /dev/null; then
        CONTAINER_CMD="docker"
    else
        echo "No container runtime found."
        exit 2
    fi
}

# Check if container is running
check_container_running() {
    local service=$1
    local container="$COMPOSE_PROJECT_NAME-$service"
    
    local status=$($CONTAINER_CMD inspect --format '{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
    
    if [ "$status" = "running" ]; then
        echo "pass"
    else
        echo "fail:$status"
    fi
}

# Check container health status
check_container_health() {
    local service=$1
    local container="$COMPOSE_PROJECT_NAME-$service"
    
    local health=$($CONTAINER_CMD inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no_healthcheck{{end}}' "$container" 2>/dev/null || echo "unknown")
    
    case $health in
        healthy)
            echo "pass"
            ;;
        no_healthcheck)
            echo "skip"
            ;;
        *)
            echo "fail:$health"
            ;;
    esac
}

# Check HTTP endpoint
check_http_endpoint() {
    local url=$1
    local expected_code=${2:-200}
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$CHECK_TIMEOUT" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected_code" ]; then
        echo "pass"
    else
        echo "fail:HTTP $response"
    fi
}

# Check TCP port
check_tcp_port() {
    local host=$1
    local port=$2
    
    if timeout "$CHECK_TIMEOUT" bash -c "echo > /dev/tcp/$host/$port" 2>/dev/null; then
        echo "pass"
    else
        echo "fail:connection_refused"
    fi
}

# Print check result
print_result() {
    local check=$1
    local result=$2
    
    local status="${result%%:*}"
    local detail="${result#*:}"
    
    case $status in
        pass)
            printf "  ${GREEN}✓${NC} %-30s ${GREEN}PASS${NC}\n" "$check"
            ;;
        fail)
            printf "  ${RED}✗${NC} %-30s ${RED}FAIL${NC} (%s)\n" "$check" "$detail"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            ;;
        skip)
            printf "  ${YELLOW}○${NC} %-30s ${YELLOW}SKIP${NC}\n" "$check"
            ;;
        *)
            printf "  ${YELLOW}?${NC} %-30s ${YELLOW}UNKNOWN${NC}\n" "$check"
            ;;
    esac
}

# Check a service
check_service() {
    local service=$1
    
    echo ""
    echo -e "${BLUE}$service${NC}"
    echo "─────────────────────────────────────────"
    
    # Container status
    print_result "Container running" "$(check_container_running "$service")"
    
    # Container health
    print_result "Health check" "$(check_container_health "$service")"
    
    # Service-specific checks
    case $service in
        frontend)
            print_result "HTTP :3000" "$(check_http_endpoint "http://localhost:3000")"
            ;;
        traefik)
            print_result "HTTP :80" "$(check_http_endpoint "http://localhost:80" "404")"
            print_result "Dashboard :8080" "$(check_http_endpoint "http://localhost:8080/ping")"
            ;;
        email-service)
            print_result "HTTP :3001/health" "$(check_http_endpoint "http://localhost:3001/health")"
            ;;
        auth-service)
            print_result "HTTP :3002/health" "$(check_http_endpoint "http://localhost:3002/health")"
            ;;
        postgres)
            print_result "TCP :5432" "$(check_tcp_port "localhost" "5432")"
            ;;
        mongodb)
            print_result "TCP :27017" "$(check_tcp_port "localhost" "27017")"
            ;;
        kafka)
            print_result "TCP :9092" "$(check_tcp_port "localhost" "9092")"
            ;;
        zookeeper)
            print_result "TCP :2181" "$(check_tcp_port "localhost" "2181")"
            ;;
        elasticsearch)
            print_result "HTTP :9200" "$(check_http_endpoint "http://localhost:9200")"
            print_result "Cluster health" "$(check_http_endpoint "http://localhost:9200/_cluster/health")"
            ;;
        logstash)
            print_result "TCP :5044" "$(check_tcp_port "localhost" "5044")"
            print_result "API :9600" "$(check_http_endpoint "http://localhost:9600")"
            ;;
        kibana)
            print_result "HTTP :5601" "$(check_http_endpoint "http://localhost:5601")"
            ;;
        grafana)
            print_result "HTTP :3030" "$(check_http_endpoint "http://localhost:3030/api/health")"
            ;;
        prometheus)
            print_result "HTTP :9090" "$(check_http_endpoint "http://localhost:9090/-/healthy")"
            ;;
        jaeger)
            print_result "HTTP :16686" "$(check_http_endpoint "http://localhost:16686")"
            ;;
    esac
}

# Check all services
check_all_services() {
    local services=(
        "postgres"
        "mongodb"
        "zookeeper"
        "kafka"
        "elasticsearch"
        "logstash"
        "kibana"
        "prometheus"
        "grafana"
        "jaeger"
        "auth-service"
        "email-service"
        "notification-service"
        "frontend"
        "traefik"
    )
    
    for service in "${services[@]}"; do
        check_service "$service"
    done
}

# Print summary
print_summary() {
    echo ""
    echo "============================================"
    if [ "$FAILED_CHECKS" -eq 0 ]; then
        echo -e "${GREEN}All health checks passed!${NC}"
    else
        echo -e "${RED}$FAILED_CHECKS check(s) failed${NC}"
    fi
    echo "============================================"
}

# Watch mode
watch_mode() {
    while true; do
        clear
        echo "============================================"
        echo "ECCS Health Monitor"
        echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "============================================"
        
        FAILED_CHECKS=0
        check_all_services
        print_summary
        
        echo ""
        echo "Press Ctrl+C to exit. Refreshing every 30 seconds..."
        sleep 30
    done
}

# ============================================================================
# Main Script
# ============================================================================

# Parse arguments
WATCH=""
JSON=""
VERBOSE=""
SERVICES=""
FAILED_CHECKS=0

while [[ $# -gt 0 ]]; do
    case $1 in
        --watch)
            WATCH="true"
            shift
            ;;
        --json)
            JSON="true"
            shift
            ;;
        --verbose)
            VERBOSE="true"
            shift
            ;;
        --timeout)
            CHECK_TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            show_help
            exit 2
            ;;
        *)
            SERVICES="$SERVICES $1"
            shift
            ;;
    esac
done

detect_runtime

echo ""
echo "============================================"
echo "ECCS Platform Health Check"
echo "============================================"
echo "Runtime: $CONTAINER_CMD"
echo "Timeout: ${CHECK_TIMEOUT}s"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"

if [ "$WATCH" = "true" ]; then
    watch_mode
elif [ -n "$SERVICES" ]; then
    for service in $SERVICES; do
        check_service "$service"
    done
else
    check_all_services
fi

print_summary

# Exit with appropriate code
if [ "$FAILED_CHECKS" -gt 0 ]; then
    exit 1
fi

exit 0

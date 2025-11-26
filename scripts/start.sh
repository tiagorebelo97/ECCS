#!/bin/bash
# ============================================================================
# ECCS Platform Start Script
# ============================================================================
# This script starts all ECCS services in the correct dependency order.
# It supports both Podman and Docker container runtimes.
#
# USAGE:
#   ./start.sh              # Start all services in production mode
#   ./start.sh dev          # Start with development settings
#   ./start.sh infra        # Start infrastructure only (databases, etc.)
#   ./start.sh --help       # Show help message
#
# STARTUP ORDER:
#   1. Infrastructure (databases, message queue, monitoring infra)
#   2. Observability stack (logging, metrics, tracing)
#   3. Backend services (auth, email, notification)
#   4. Frontend and API gateway
#
# PREREQUISITES:
#   - Podman or Docker installed
#   - podman-compose or docker-compose installed
#   - .env file configured (copy from .env.example)
#
# ENVIRONMENT VARIABLES:
#   - CONTAINER_RUNTIME: 'podman' or 'docker' (auto-detected)
#   - COMPOSE_PROJECT_NAME: Project name prefix (default: eccs)
#   - STARTUP_TIMEOUT: Timeout for health checks in seconds (default: 120)
# ============================================================================

set -e  # Exit on any error

# ============================================================================
# Configuration
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/podman-compose.yml"

# Default settings
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-eccs}"
STARTUP_TIMEOUT="${STARTUP_TIMEOUT:-120}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

# Print colored message
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

# Print usage information
show_help() {
    cat << EOF
ECCS Platform Start Script

Usage: $0 [MODE] [OPTIONS]

Modes:
  (default)     Start all services in production mode
  dev           Start with development settings (hot reload, debug logging)
  infra         Start infrastructure only (databases, Kafka, monitoring)
  backend       Start backend services only (requires infrastructure)
  frontend      Start frontend and gateway only (requires backend)

Options:
  -d, --detach          Run in background (detached mode)
  -f, --force-recreate  Force recreate all containers
  --build               Build images before starting
  --no-cache            Build without using cache
  -v, --verbose         Verbose output
  -h, --help            Show this help message

Examples:
  $0                    # Start all services
  $0 dev --build        # Development mode with rebuild
  $0 infra -d           # Start infrastructure in background
  $0 --force-recreate   # Recreate all containers

Environment Variables:
  CONTAINER_RUNTIME     Container runtime (podman/docker, auto-detected)
  COMPOSE_PROJECT_NAME  Project name prefix (default: eccs)
  STARTUP_TIMEOUT       Health check timeout in seconds (default: 120)

EOF
}

# Detect container runtime (Podman or Docker)
detect_runtime() {
    if command -v podman &> /dev/null && command -v podman-compose &> /dev/null; then
        CONTAINER_RUNTIME="podman"
        COMPOSE_CMD="podman-compose"
        CONTAINER_CMD="podman"
        log_info "Detected Podman container runtime"
    elif command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        CONTAINER_RUNTIME="docker"
        COMPOSE_CMD="docker-compose"
        CONTAINER_CMD="docker"
        log_info "Detected Docker container runtime"
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        CONTAINER_RUNTIME="docker"
        COMPOSE_CMD="docker compose"
        CONTAINER_CMD="docker"
        log_info "Detected Docker with compose plugin"
    else
        log_error "No container runtime found. Please install Podman or Docker."
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    # Check .env file
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        if [ -f "$PROJECT_ROOT/.env.example" ]; then
            log_warning ".env file not found. Creating from .env.example"
            cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
            log_warning "Please edit .env file with your configuration!"
        else
            log_error ".env file not found. Please create one from .env.example"
            exit 1
        fi
    fi
    
    # Check Podman socket (if using Podman)
    if [ "$CONTAINER_RUNTIME" = "podman" ]; then
        PODMAN_SOCKET="/run/user/$(id -u)/podman/podman.sock"
        if [ ! -S "$PODMAN_SOCKET" ]; then
            log_info "Starting Podman socket..."
            systemctl --user start podman.socket 2>/dev/null || \
                podman system service --time=0 &
            sleep 2
        fi
        # Set container socket for Traefik
        export CONTAINER_SOCK="$PODMAN_SOCKET"
    else
        export CONTAINER_SOCK="/var/run/docker.sock"
    fi
    
    # Generate TLS certificates if they don't exist (required for Traefik)
    CERT_DIR="$PROJECT_ROOT/infrastructure/traefik/certs"
    if [ ! -f "$CERT_DIR/eccs.crt" ] || [ ! -f "$CERT_DIR/eccs.key" ]; then
        log_info "TLS certificates not found. Generating self-signed certificates..."
        if [ -f "$CERT_DIR/generate-certs.sh" ]; then
            (cd "$CERT_DIR" && bash generate-certs.sh)
        else
            # Inline certificate generation as fallback
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$CERT_DIR/eccs.key" \
                -out "$CERT_DIR/eccs.crt" \
                -subj "/C=US/ST=State/L=City/O=ECCS/OU=Development/CN=localhost" \
                -addext "subjectAltName=DNS:localhost,DNS:*.localhost,DNS:api.localhost,DNS:traefik.localhost,IP:127.0.0.1" 2>/dev/null
            chmod 600 "$CERT_DIR/eccs.key"
            chmod 644 "$CERT_DIR/eccs.crt"
        fi
        log_success "TLS certificates generated"
    fi
    
    log_success "Prerequisites check passed"
}

# Wait for a service to be healthy
wait_for_service() {
    local service=$1
    local port=$2
    local timeout=${3:-60}
    local start_time=$(date +%s)
    
    log_info "Waiting for $service to be healthy..."
    
    while true; do
        if $CONTAINER_CMD exec "$COMPOSE_PROJECT_NAME-$service" sh -c "exit 0" 2>/dev/null; then
            # Container is running, check if service is responding
            if curl -sf "http://localhost:$port" > /dev/null 2>&1 || \
               curl -sf "http://localhost:$port/health" > /dev/null 2>&1; then
                log_success "$service is healthy"
                return 0
            fi
        fi
        
        local elapsed=$(($(date +%s) - start_time))
        if [ $elapsed -ge $timeout ]; then
            log_warning "$service health check timed out after ${timeout}s"
            return 1
        fi
        
        sleep 2
    done
}

# Start infrastructure services
start_infrastructure() {
    log_info "Starting infrastructure services..."
    
    # Start databases and message queue
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d \
        postgres \
        mongodb \
        zookeeper \
        kafka \
        elasticsearch
    
    # Wait for critical services
    log_info "Waiting for infrastructure to be ready..."
    sleep 10  # Initial wait for containers to start
    
    wait_for_service "postgres" 5432 60 || true
    wait_for_service "mongodb" 27017 60 || true
    wait_for_service "elasticsearch" 9200 120 || true
    
    log_success "Infrastructure services started"
}

# Start observability stack
start_observability() {
    log_info "Starting observability stack..."
    
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d \
        logstash \
        kibana \
        prometheus \
        grafana \
        jaeger
    
    log_success "Observability stack started"
}

# Start backend services
start_backend() {
    log_info "Starting backend services..."
    
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d \
        auth-service \
        email-service \
        notification-service
    
    # Wait for backend services
    sleep 5
    wait_for_service "auth-service" 3002 60 || true
    wait_for_service "email-service" 3001 60 || true
    
    log_success "Backend services started"
}

# Start frontend and gateway
start_frontend() {
    log_info "Starting frontend and API gateway..."
    
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d \
        frontend \
        traefik
    
    # Wait for frontend
    sleep 5
    wait_for_service "frontend" 3000 60 || true
    
    log_success "Frontend and gateway started"
}

# Start all services
start_all() {
    local flags="$1"
    
    log_info "Starting all ECCS services..."
    
    # Start in order
    start_infrastructure
    start_observability
    start_backend
    start_frontend
    
    log_success "All ECCS services started!"
}

# Print service URLs
print_service_urls() {
    echo ""
    echo "============================================"
    echo "ECCS Platform Started Successfully!"
    echo "============================================"
    echo ""
    echo "Service URLs:"
    echo "  Frontend:      http://localhost:3000"
    echo "  API Gateway:   http://localhost:80"
    echo "  Traefik:       http://localhost:8080"
    echo "  Kibana:        http://localhost:5601"
    echo "  Grafana:       http://localhost:3030"
    echo "  Prometheus:    http://localhost:9090"
    echo "  Jaeger:        http://localhost:16686"
    echo "  Elasticsearch: http://localhost:9200"
    echo ""
    echo "Database Connections:"
    echo "  PostgreSQL:    localhost:5432"
    echo "  MongoDB:       localhost:27017"
    echo "  Kafka:         localhost:9092"
    echo ""
    echo "To view logs: ./logs.sh [service]"
    echo "To stop:      ./stop.sh"
    echo "============================================"
}

# ============================================================================
# Main Script
# ============================================================================

# Parse command line arguments
MODE=""
DETACH=""
BUILD=""
FORCE_RECREATE=""
VERBOSE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        dev|infra|backend|frontend)
            MODE=$1
            shift
            ;;
        -d|--detach)
            DETACH="-d"
            shift
            ;;
        -f|--force-recreate)
            FORCE_RECREATE="--force-recreate"
            shift
            ;;
        --build)
            BUILD="--build"
            shift
            ;;
        --no-cache)
            BUILD="--build --no-cache"
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
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
echo ""
echo "============================================"
echo "ECCS Platform Startup"
echo "============================================"
echo ""

detect_runtime
check_prerequisites

cd "$PROJECT_ROOT"

case $MODE in
    dev)
        log_info "Starting in development mode..."
        export NODE_ENV=development
        $COMPOSE_CMD -f "$COMPOSE_FILE" up $BUILD $FORCE_RECREATE $DETACH
        ;;
    infra)
        start_infrastructure
        ;;
    backend)
        start_backend
        ;;
    frontend)
        start_frontend
        ;;
    *)
        start_all
        print_service_urls
        ;;
esac

exit 0

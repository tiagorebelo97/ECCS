# ECCS Deployment Guide

## Prerequisites

- Podman or Docker installed
- Node.js 18+ (for local development)
- Git
- kubectl (for Kubernetes deployment)

## Local Development

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/ECCS.git
cd ECCS

# Copy environment file
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your configuration:

```bash
# Required
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_key

# SMTP (for email sending)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional
GRAFANA_PASSWORD=admin123
```

### 3. Start All Services

```bash
# Using Podman
podman-compose up -d

# Or using Docker
docker-compose -f podman-compose.yml up -d
```

### 4. Verify Services

```bash
# Check service status
podman-compose ps

# Check logs
podman-compose logs -f email-service
```

### 5. Access Applications

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8800 |
| Traefik Dashboard | http://localhost:8080 |
| Grafana | http://localhost:3030 |
| Kibana | http://localhost:5601 |
| Jaeger | http://localhost:16686 |
| Prometheus | http://localhost:9090 |

**Note:** The API Gateway uses port 8800 (instead of 80 or 8000) to avoid conflicts with commonly used ports and for rootless Podman compatibility. Privileged ports (< 1024) require root access.

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace eccs
```

### 2. Create Secrets

```bash
kubectl create secret generic eccs-secrets \
  --from-literal=postgres-host=postgres \
  --from-literal=postgres-password=your_password \
  --from-literal=jwt-secret=your_jwt_secret \
  --from-literal=mongodb-uri=mongodb://mongodb:27017/eccs_logs \
  -n eccs
```

### 3. Deploy Applications

```bash
kubectl apply -f infrastructure/kubernetes/ -n eccs
```

### 4. Verify Deployment

```bash
kubectl get pods -n eccs
kubectl get svc -n eccs
kubectl get hpa -n eccs
```

### 5. Access via Port-Forward

```bash
kubectl port-forward svc/frontend 3000:3000 -n eccs
kubectl port-forward svc/grafana 3030:3000 -n eccs
```

## Production Deployment

### Security Considerations

1. **Use strong passwords** - Generate secure random passwords for all services
2. **Enable TLS** - Configure Traefik with valid SSL certificates
3. **Restrict network access** - Use network policies to limit inter-service communication
4. **Rotate secrets regularly** - Implement secret rotation policies
5. **Enable audit logging** - Ensure all access is logged

### High Availability

1. **Database replication** - Set up PostgreSQL and MongoDB replicas
2. **Multi-zone deployment** - Deploy across multiple availability zones
3. **Load balancing** - Configure Traefik with multiple backend instances
4. **Backup automation** - Schedule regular backups

### Scaling

The system supports horizontal scaling through:

1. **Kubernetes HPA** - Automatic pod scaling based on CPU/memory
2. **Kafka partitions** - Scale notification consumers
3. **Database read replicas** - Scale read operations

### Monitoring

1. Configure alerting rules in Prometheus
2. Set up PagerDuty or Slack integrations
3. Create custom Grafana dashboards
4. Review Jaeger traces for performance issues

## Backup and Recovery

### Automated Backups

Schedule daily backups:

```bash
# Add to crontab
0 2 * * * /path/to/ECCS/scripts/backup.sh >> /var/log/eccs-backup.log 2>&1
```

### Manual Backup

```bash
./scripts/backup.sh
```

### Restore from Backup

```bash
# List available backups
ls /backups/

# Restore specific backup
./scripts/restore.sh 20240115_020000
```

## Troubleshooting

### Service Won't Start

1. Check logs: `podman-compose logs <service-name>`
2. Verify environment variables in `.env`
3. Check disk space and memory

### Database Connection Failed

1. Verify PostgreSQL is running: `podman-compose ps postgres`
2. Check credentials in environment variables
3. Test connection: `psql -h localhost -U eccs_user -d eccs_email`

### Kafka Consumer Lag

1. Check Jaeger for slow consumers
2. Scale notification-service replicas
3. Review DLQ for failed messages

### Email Delivery Issues

1. Verify SMTP credentials
2. Check notification-service logs
3. Review DLQ topic for failed emails

## Maintenance

### Update Services

```bash
# Pull latest images
podman-compose pull

# Restart with new images
podman-compose up -d
```

### Clean Up

```bash
# Remove stopped containers
podman-compose down

# Remove volumes (WARNING: deletes data)
podman-compose down -v
```

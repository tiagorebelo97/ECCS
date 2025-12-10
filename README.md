# ECCS - Enterprise Cloud Communication System

A fully containerized microservices email system built with modern cloud-native technologies.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ECCS Architecture                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌──────────────────────────────────────────────────┐   │
│  │   React     │────▶│              Traefik API Gateway                 │   │
│  │  Frontend   │     │         (JWT Auth, Rate Limiting)                │   │
│  └─────────────┘     └──────────────────────────────────────────────────┘   │
│                                        │                                     │
│                       ┌────────────────┼────────────────┐                   │
│                       ▼                ▼                ▼                   │
│              ┌─────────────┐   ┌─────────────┐   ┌──────────────┐          │
│              │   Auth      │   │   Email     │   │ Notification │          │
│              │  Service    │   │  Service    │   │   Service    │          │
│              └─────────────┘   └─────────────┘   └──────────────┘          │
│                     │                │                  │                   │
│                     ▼                ▼                  ▼                   │
│              ┌─────────────┐   ┌─────────────┐   ┌──────────────┐          │
│              │ PostgreSQL  │   │   Kafka     │◀──│  Dead Letter │          │
│              │             │   │             │   │    Queue     │          │
│              └─────────────┘   └─────────────┘   └──────────────┘          │
│                                      │                                      │
│                     ┌────────────────┴────────────────┐                    │
│                     ▼                                 ▼                    │
│              ┌─────────────┐                  ┌──────────────┐             │
│              │  MongoDB    │                  │   Postfix    │             │
│              │  (Logging)  │                  │   (SMTP)     │             │
│              └─────────────┘                  └──────────────┘             │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Observability Stack                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │  │
│  │  │ Grafana  │  │Prometheus│  │  Jaeger  │  │ELK Stack │             │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Features

### Core Services
- **React Frontend** - Modern, responsive UI for email management
- **Node.js Backend Services** - Microservices architecture with Express.js
- **PostgreSQL Database** - Primary data storage for users, emails, and locations
- **MongoDB** - Logging and audit trail storage

### Location Management
- **Interactive World Map** - Click to save locations with Leaflet
- **Reverse Geocoding** - Automatic address lookup from coordinates
- **Elasticsearch Integration** - Geo-point indexing for Kibana map visualization
- **Rate-Limited API** - Compliant with OpenStreetMap Nominatim usage policy

### Messaging & Integration
- **Apache Kafka** - Message queue for async email processing
- **Retry Mechanism** - Automatic retries with exponential backoff
- **Dead Letter Queue (DLQ)** - Failed message handling for debugging

### API Gateway
- **Traefik** - Modern reverse proxy and load balancer
- **JWT Authentication** - Secure API access
- **Rate Limiting** - Protection against abuse
- **Circuit Breaker** - Fault tolerance

### Observability
- **ELK Stack** - Centralized logging (Elasticsearch, Logstash, Kibana)
- **Grafana** - Metrics visualization and dashboards
- **Prometheus** - Metrics collection
- **Jaeger** - Distributed tracing

### DevOps
- **Podman** - Container orchestration (Docker compatible)
- **CI/CD Pipeline** - GitHub Actions workflow
- **Automated Backups** - PostgreSQL and MongoDB backup scripts
- **Autoscaling** - Kubernetes HPA configuration

## 📋 Prerequisites

- Podman or Docker
- Node.js 18+
- Git

## 🛠️ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ECCS.git
cd ECCS
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Services

```bash
# Using Podman
podman-compose up -d

# Or using Docker
docker-compose -f podman-compose.yml up -d
```

### 4. Access the Application

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Traefik Dashboard | http://localhost:8080 |
| Grafana | http://localhost:3030 |
| Kibana | http://localhost:5601 |
| Jaeger | http://localhost:16686 |
| Prometheus | http://localhost:9091 |

## 📁 Project Structure

```
ECCS/
├── frontend/                    # React frontend application
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── backend/
│   ├── email-service/          # Email management API
│   ├── auth-service/           # Authentication service
│   ├── notification-service/   # Kafka consumer for email sending
│   └── locations-service/      # Location management API
├── database/
│   ├── postgres/               # PostgreSQL initialization
│   └── mongodb/                # MongoDB initialization
├── infrastructure/
│   ├── traefik/                # API Gateway configuration
│   ├── elk/                    # ELK Stack configuration
│   ├── grafana/                # Monitoring dashboards
│   ├── kafka/                  # Kafka configuration
│   └── kubernetes/             # K8s deployment configs
├── scripts/
│   ├── backup.sh               # Database backup script
│   └── restore.sh              # Database restore script
├── .github/
│   └── workflows/              # CI/CD pipelines
├── podman-compose.yml          # Container orchestration
└── README.md
```

## 🔧 Services Configuration

### Email Service (Port 3001)
Handles email CRUD operations and queues messages to Kafka.

**Endpoints:**
- `GET /api/emails` - List user emails
- `GET /api/emails/stats` - Get email statistics
- `POST /api/emails/send` - Queue email for sending
- `GET /api/emails/:id` - Get specific email

### Auth Service (Port 3002)
Manages user authentication and JWT tokens.

**Endpoints:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/refresh` - Refresh JWT token

### Locations Service (Port 3003)
Handles map location management with reverse geocoding.

**Endpoints:**
- `GET /api/locations` - List user's saved locations
- `POST /api/locations` - Save a new location
- `GET /api/locations/:id` - Get specific location
- `PUT /api/locations/:id` - Update a location
- `DELETE /api/locations/:id` - Delete a location
- `GET /api/locations/reverse-geocode/:lat/:lon` - Get address from coordinates

**Features:**
- Interactive world map with Leaflet
- Reverse geocoding via OpenStreetMap Nominatim
- Rate limiting and caching for geocoding API
- Elasticsearch indexing for Kibana map visualization

### Notification Service (Port 3004)
Kafka consumer that processes emails with retry logic.

**Features:**
- 3 retry attempts with exponential backoff
- Dead Letter Queue for failed messages
- SMTP integration for email delivery
- **Postfix** - Production SMTP server included for real email delivery
- Supports external relay hosts (Gmail, SendGrid, AWS SES) for better deliverability

## 📊 Monitoring

### Grafana Dashboards
Pre-configured dashboards for:
- **ECCS Operations Dashboard** - Comprehensive monitoring with throughput, failures, and queue metrics
- Email processing rates and success rates
- API latency (p50, p90, p95, p99)
- Error rates and DLQ metrics
- Kafka consumer lag and retry queue depth
- Service health status

Access at: http://localhost:3030

### Prometheus Metrics
Each service exposes `/metrics` endpoint with:
- HTTP request duration histograms
- Email processing counters (`emails_processed_total`)
- Email processing duration (`email_processing_duration_seconds`)
- Retry queue depth (`email_retry_queue_depth`)
- System resource metrics

### Kafka Exporter
Kafka metrics exposed via kafka-exporter at port 9308:
- Consumer group lag per topic/partition
- Broker count and health
- Topic partition offsets

### Alerting
Prometheus alerting rules configured for:
- High error rates (>5% email failures)
- High latency (p95 > 10s)
- Queue depth thresholds
- DLQ accumulation
- Service availability
- RTO breach detection

Alert notifications via Alertmanager (port 9093) to:
- Slack channels
- Email
- PagerDuty
- Custom webhooks

For detailed documentation, see [docs/MONITORING_ALERTING.md](docs/MONITORING_ALERTING.md).

### Distributed Tracing
Jaeger provides end-to-end request tracing across services.

### Centralized Logging with ELK Stack
All backend services (email-service, auth-service, notification-service) send structured JSON logs to Elasticsearch via Logstash for centralized monitoring and analysis.

**Features:**
- Automatic ELK stack initialization on first startup
- Pre-configured Kibana dashboards for email processing
- Index Lifecycle Management (ILM) with 90-day retention
- Daily log rotation

**Access Kibana at:** http://localhost:5601

**Pre-configured Dashboards:**
- **[ECCS] Email Processing Dashboard** - Error rates, latency metrics, retry analysis

**Useful Kibana Filters:**
- `service:email-service` - Email service logs
- `service:auth-service` - Authentication service logs  
- `service:notification-service` - Email processing logs
- `level:error` - Show only errors
- `status:failed OR status:retry` - Failed email deliveries
- `latencyMs:[5000 TO *]` - Slow processing (>5 seconds)
- `sentToDlq:true` - Dead letter queue entries

**Manual Initialization (if needed):**
```bash
./scripts/init-elk.sh
```

## 🔐 Security

- JWT-based authentication
- bcrypt password hashing
- Helmet.js security headers
- CORS configuration
- Rate limiting
- Input validation

## 🔄 Backup & Recovery

### Manual Backup
```bash
./scripts/backup.sh
```

### Scheduled Backup (Cron)
```bash
# Add to crontab for daily backups at 2 AM
0 2 * * * /path/to/ECCS/scripts/backup.sh
```

### Restore from Backup
```bash
./scripts/restore.sh <backup_timestamp>
```

## 📈 Autoscaling (Kubernetes)

Horizontal Pod Autoscaler configurations for:
- CPU-based scaling (70% threshold)
- Memory-based scaling (80% threshold)
- Custom metrics (Kafka consumer lag)

Apply with:
```bash
kubectl apply -f infrastructure/kubernetes/
```

## 🧪 Testing

```bash
# Run tests for all services
cd backend/email-service && npm test
cd backend/auth-service && npm test
cd backend/notification-service && npm test
cd frontend && npm test
```

## 🚢 CI/CD Pipeline

GitHub Actions workflow includes:
1. **Lint** - Code quality checks
2. **Test** - Unit and integration tests
3. **Build** - Docker image creation
4. **Security Scan** - Trivy vulnerability scanning
5. **Deploy** - Staging and production deployments

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password | - |
| `JWT_SECRET` | JWT signing secret | - |
| `SMTP_HOST` | SMTP server host | postfix |
| `SMTP_PORT` | SMTP server port | 25 |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `GRAFANA_PASSWORD` | Grafana admin password | admin123 |
| `LOGSTASH_HOST` | Logstash server host | logstash |
| `LOGSTASH_PORT` | Logstash TCP port | 5000 |

## 📚 Documentation

### API Gateway Deep Dive
A comprehensive 45-slide PowerPoint presentation explaining Traefik API Gateway implementation:
- **[API Gateway Deep Dive Presentation](docs/API_Gateway_Deep_Dive.pptx)** - Complete PowerPoint with architecture, security, integration patterns, and best practices
- **[Presentation Guide](docs/API_GATEWAY_PRESENTATION_README.md)** - How to use the presentation
- **[Implementation Summary](docs/API_GATEWAY_SUMMARY.md)** - Quick reference with code examples

### Additional Documentation
- **[Traefik Security](docs/TRAEFIK_SECURITY.md)** - Security architecture and configuration
- **[API Documentation](docs/API.md)** - REST API endpoints
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Monitoring & Alerting](docs/MONITORING_ALERTING.md)** - Observability setup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Traefik](https://traefik.io/) - Cloud-native API Gateway
- [Kafka](https://kafka.apache.org/) - Distributed streaming platform
- [Elastic Stack](https://www.elastic.co/) - Observability platform
- [Grafana](https://grafana.com/) - Analytics & monitoring
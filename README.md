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
│              │  MongoDB    │                  │    SMTP      │             │
│              │  (Logging)  │                  │   Server     │             │
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
- **PostgreSQL Database** - Primary data storage for users and emails
- **MongoDB** - Logging and audit trail storage

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
| Prometheus | http://localhost:9090 |

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
│   └── notification-service/   # Kafka consumer for email sending
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

### Notification Service
Kafka consumer that processes emails with retry logic.

**Features:**
- 3 retry attempts with exponential backoff
- Dead Letter Queue for failed messages
- SMTP integration for email delivery

## 📊 Monitoring

### Grafana Dashboards
Pre-configured dashboards for:
- Email processing rates
- API latency (p95, p99)
- Error rates
- Kafka consumer lag

### Prometheus Metrics
Each service exposes `/metrics` endpoint with:
- HTTP request duration histograms
- Email processing counters
- System resource metrics

### Distributed Tracing
Jaeger provides end-to-end request tracing across services.

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
| `SMTP_HOST` | SMTP server host | - |
| `SMTP_PORT` | SMTP server port | 587 |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `GRAFANA_PASSWORD` | Grafana admin password | admin123 |

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
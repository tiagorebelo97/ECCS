# ECCS Grafana Monitoring and Alerting Guide

This document describes the comprehensive monitoring and alerting setup for the ECCS (Enterprise Cloud Communication System) platform.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prometheus Exporters](#prometheus-exporters)
3. [Grafana Dashboards](#grafana-dashboards)
4. [Alert Rules](#alert-rules)
5. [Notification Channels and Escalation](#notification-channels-and-escalation)
6. [Recovery Time Objectives (RTO)](#recovery-time-objectives-rto)
7. [Runbooks](#runbooks)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ECCS Monitoring Architecture                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌───────────────────────────────────────────────────────────────────────┐  │
│   │                     Application Layer                                   │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐ │  │
│   │  │Email Service │  │ Auth Service │  │  Notification Service        │ │  │
│   │  │   :3001      │  │    :3002     │  │       :3003                  │ │  │
│   │  │  /metrics    │  │   /metrics   │  │      /metrics                │ │  │
│   │  └──────────────┘  └──────────────┘  └──────────────────────────────┘ │  │
│   └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│   ┌───────────────────────────────────────────────────────────────────────┐  │
│   │                     Infrastructure Layer                               │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐ │  │
│   │  │    Kafka     │──│Kafka Exporter│  │       Traefik                │ │  │
│   │  │   :9092      │  │    :9308     │  │    :8080/metrics             │ │  │
│   │  └──────────────┘  └──────────────┘  └──────────────────────────────┘ │  │
│   └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                          │
│                                    ▼                                          │
│   ┌───────────────────────────────────────────────────────────────────────┐  │
│   │                     Observability Stack                                │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐ │  │
│   │  │  Prometheus  │──│ Alertmanager │──│         Grafana              │ │  │
│   │  │    :9090     │  │    :9093     │  │          :3030               │ │  │
│   │  └──────────────┘  └──────────────┘  └──────────────────────────────┘ │  │
│   │         │                  │                                           │  │
│   │         │                  ▼                                           │  │
│   │         │         ┌────────────────────────────────────────────────┐  │  │
│   │         │         │           Notification Channels                │  │  │
│   │         │         │  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────┐ │  │  │
│   │         │         │  │ Slack  │ │ Email  │ │PagerDuty│ │ Webhook │ │  │  │
│   │         │         │  └────────┘ └────────┘ └────────┘ └─────────┘ │  │  │
│   │         │         └────────────────────────────────────────────────┘  │  │
│   └─────────┴─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prometheus Exporters

### Node.js Services Metrics

All Node.js backend services expose Prometheus metrics via the `prom-client` library at the `/metrics` endpoint.

#### Email Service (`:3001/metrics`)

| Metric | Type | Description |
|--------|------|-------------|
| `http_request_duration_seconds` | Histogram | HTTP request latency by method, route, status |
| `process_cpu_*` | Gauge | CPU usage metrics |
| `process_resident_memory_bytes` | Gauge | Memory usage |
| `nodejs_eventloop_lag_seconds` | Gauge | Event loop lag |

#### Auth Service (`:3002/metrics`)

| Metric | Type | Description |
|--------|------|-------------|
| `http_request_duration_seconds` | Histogram | HTTP request latency |
| Default Node.js metrics | Various | Standard runtime metrics |

#### Notification Service (`:3003/metrics`)

| Metric | Type | Description |
|--------|------|-------------|
| `emails_processed_total` | Counter | Total emails processed (labels: status) |
| `email_processing_duration_seconds` | Histogram | Email processing latency |
| `email_retry_queue_depth` | Gauge | Current retry queue size |
| Default Node.js metrics | Various | Standard runtime metrics |

### Kafka Exporter (`:9308/metrics`)

The Kafka exporter (`danielqsj/kafka-exporter`) connects to Kafka brokers and exposes cluster metrics.

| Metric | Type | Description |
|--------|------|-------------|
| `kafka_consumergroup_lag` | Gauge | Consumer lag per partition |
| `kafka_brokers` | Gauge | Number of brokers in cluster |
| `kafka_topic_partitions` | Gauge | Partitions per topic |
| `kafka_topic_partition_current_offset` | Gauge | Current offset per partition |
| `kafka_consumergroup_current_offset` | Gauge | Consumer group offset |

### Traefik (`:8080/metrics`)

| Metric | Type | Description |
|--------|------|-------------|
| `traefik_service_requests_total` | Counter | Total requests per service |
| `traefik_service_request_duration_seconds` | Histogram | Request duration per service |
| `traefik_entrypoint_requests_total` | Counter | Requests per entrypoint |

---

## Grafana Dashboards

### ECCS Operations Dashboard

**UID:** `eccs-operations`
**URL:** `http://grafana.localhost/d/eccs-operations`

This comprehensive dashboard provides real-time visibility into the ECCS platform operations.

#### Overview Section
- **Email Throughput** - Emails processed per second
- **Success Rate** - Percentage of successful email deliveries
- **Retry Queue** - Current messages awaiting retry
- **DLQ (24h)** - Dead letter queue count in last 24 hours
- **P95 Latency** - 95th percentile processing latency
- **Services Up** - Number of healthy services

#### Throughput & Processing Section
- **Email Processing Rate by Status** - Time series of success/retry/failed/dlq rates
- **Email Processing Latency Percentiles** - p50, p90, p95, p99 latencies

#### Failures & Errors Section
- **Error Rates** - Email and API error rates over time
- **Failed Emails & DLQ** - Hourly counts of failures

#### Queue Metrics Section
- **Retry Queue Depth** - Current retry queue size over time
- **Kafka Consumer Lag by Topic** - Consumer lag per Kafka topic

#### Service Health Section
- **Service Status** - UP/DOWN status for all services
- **Service Memory Usage** - Memory consumption per service
- **API Request Rate by Service** - Request rate per backend service

### ECCS Main Dashboard

**UID:** `eccs-main-dashboard`
**URL:** `http://grafana.localhost/d/eccs-main-dashboard`

Basic dashboard with email processing rate, API latency, and request rates.

---

## Alert Rules

Alert rules are defined in `infrastructure/grafana/alerting-rules.yml` and evaluated by Prometheus.

### Email Processing Alerts

| Alert | Condition | Severity | For Duration |
|-------|-----------|----------|--------------|
| `HighEmailErrorRate` | Error rate > 5% | Critical | 2m |
| `HighEmailProcessingLatency` | p95 > 10s | Warning | 5m |
| `HighRetryQueueDepth` | Queue > 100 messages | Warning | 5m |
| `DLQMessagesGrowing` | DLQ increase > 10/hour | Critical | 5m |
| `NoEmailsProcessed` | Zero emails in 10m | Warning | 10m |

### API Health Alerts

| Alert | Condition | Severity | For Duration |
|-------|-----------|----------|--------------|
| `HighAPIErrorRate` | 5xx rate > 1% | Critical | 2m |
| `HighAPILatency` | p95 > 2s | Warning | 5m |
| `ServiceDown` | up == 0 | Critical | 1m |

### Kafka Alerts

| Alert | Condition | Severity | For Duration |
|-------|-----------|----------|--------------|
| `HighKafkaConsumerLag` | Lag > 1000 messages | Warning | 5m |
| `KafkaUnderReplicatedPartitions` | Under-replicated > 0 | Critical | 5m |
| `KafkaBrokerOffline` | Brokers < 1 | Critical | 1m |

### RTO Alerts

| Alert | Condition | Severity | For Duration |
|-------|-----------|----------|--------------|
| `RTOBreachCritical` | Service down > 5m | Critical | 5m |
| `EmailProcessingRTOBreach` | No processing for 30m | Critical | 5m |

### Infrastructure Alerts

| Alert | Condition | Severity | For Duration |
|-------|-----------|----------|--------------|
| `HighMemoryUsage` | Memory > 450MB | Warning | 5m |
| `HighEventLoopLag` | Event loop > 0.1s | Warning | 5m |

---

## Notification Channels and Escalation

### Notification Channels

Alert notifications are configured in `infrastructure/grafana/alertmanager.yml`.

#### 1. Slack Channels

| Channel | Purpose | Alert Types |
|---------|---------|-------------|
| `#eccs-alerts` | General alerts | Warning, Info |
| `#eccs-critical` | Critical incidents | Critical, DLQ, RTO |
| `#email-team` | Email-specific alerts | Email processing issues |
| `#infrastructure` | Infrastructure alerts | Kafka, queue issues |

**Configuration Example:**
```yaml
slack_configs:
  - channel: '#eccs-alerts'
    send_resolved: true
    api_url: '${SLACK_WEBHOOK_URL}'
```

#### 2. Email Notifications

| Recipient | Purpose | Alert Types |
|-----------|---------|-------------|
| `oncall@example.com` | On-call engineer | Critical alerts |
| `email-ops@example.com` | Email operations team | DLQ alerts |
| `management@example.com` | Escalation | RTO breaches |

#### 3. PagerDuty Integration

For critical P1 incidents requiring immediate response.

| Service Key | Purpose |
|-------------|---------|
| `${PAGERDUTY_SERVICE_KEY}` | Critical incident paging |

#### 4. Webhook Integration

Custom integrations for ticketing systems, chat bots, or other automation.

```yaml
webhook_configs:
  - url: '${INCIDENT_WEBHOOK_URL}'
    send_resolved: true
```

### Escalation Paths

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Alert Escalation Flowchart                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌────────────┐                                                            │
│   │  New Alert │                                                            │
│   └─────┬──────┘                                                            │
│         │                                                                    │
│         ▼                                                                    │
│   ┌─────────────┐                                                           │
│   │  Severity?  │                                                           │
│   └──────┬──────┘                                                           │
│          │                                                                   │
│    ┌─────┴─────┬─────────────────────────┐                                  │
│    │           │                         │                                  │
│    ▼           ▼                         ▼                                  │
│ ┌──────┐  ┌────────┐              ┌──────────┐                             │
│ │ Info │  │Warning │              │ Critical │                             │
│ └──┬───┘  └───┬────┘              └────┬─────┘                             │
│    │          │                        │                                    │
│    ▼          ▼                        ▼                                    │
│ ┌──────┐  ┌────────────┐         ┌─────────────────┐                       │
│ │ Log  │  │   Slack    │         │ Slack + Email   │                       │
│ │ Only │  │  Channel   │         │ + PagerDuty     │                       │
│ └──────┘  └────────────┘         └────────┬────────┘                       │
│                                           │                                 │
│                                           ▼                                 │
│                                    ┌──────────────┐                        │
│                                    │  RTO Breach? │                        │
│                                    └──────┬───────┘                        │
│                                           │                                 │
│                                     ┌─────┴─────┐                          │
│                                     │    Yes    │                          │
│                                     │           │                          │
│                                     ▼           │                          │
│                              ┌──────────────┐   │                          │
│                              │  Management  │   │ No                       │
│                              │  Escalation  │   │                          │
│                              └──────────────┘   │                          │
│                                                 ▼                          │
│                                          ┌───────────┐                     │
│                                          │  Standard │                     │
│                                          │ Handling  │                     │
│                                          └───────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Escalation Timeline

| Time | Action |
|------|--------|
| T+0 | Alert fires, immediate notification to primary channel |
| T+1m | Critical alerts page on-call via PagerDuty |
| T+5m | If unacknowledged, escalate to secondary on-call |
| T+15m | Warning alerts: Re-notify team channel |
| T+30m | RTO breach: Escalate to management |
| T+1h | Critical alerts: Re-page all channels |

### Inhibition Rules

To prevent alert storms, the following inhibition rules are configured:

1. **Critical inhibits Warning** - When a critical alert fires for a service, warning alerts for the same service are suppressed.

2. **ServiceDown inhibits all** - When a service is completely down, other alerts for that service are suppressed.

---

## Recovery Time Objectives (RTO)

### Defined RTOs

| Service/Component | RTO Target | Alert Threshold |
|-------------------|------------|-----------------|
| Critical Services (Auth, Email, Notification) | 5 minutes | `RTOBreachCritical` |
| Email Processing Pipeline | 30 minutes | `EmailProcessingRTOBreach` |
| API Endpoints | 2 minutes | `ServiceDown` |
| Kafka Cluster | 10 minutes | `KafkaBrokerOffline` |

### RTO Monitoring

RTO compliance is monitored via:

1. **Service uptime tracking** - `up` metric for all services
2. **Processing pipeline health** - `emails_processed_total` rate
3. **Queue depth monitoring** - `email_retry_queue_depth` gauge

---

## Runbooks

Each alert includes a `runbook_url` annotation linking to detailed investigation and remediation steps.

### Example Runbook URLs

| Alert | Runbook URL |
|-------|-------------|
| HighEmailErrorRate | `https://wiki.example.com/runbooks/high-email-error-rate` |
| HighKafkaConsumerLag | `https://wiki.example.com/runbooks/kafka-consumer-lag` |
| ServiceDown | `https://wiki.example.com/runbooks/service-down` |
| DLQMessagesGrowing | `https://wiki.example.com/runbooks/dlq-investigation` |
| RTOBreachCritical | `https://wiki.example.com/runbooks/rto-breach` |

### Quick Reference Commands

```bash
# Check service health
podman-compose ps

# View service logs
podman-compose logs -f notification-service

# Check Kafka consumer lag
docker exec eccs-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --all-groups

# Check retry queue depth
curl http://localhost:3003/metrics | grep email_retry_queue_depth

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check active alerts
curl http://localhost:9093/api/v2/alerts

# Reload Prometheus configuration
curl -X POST http://localhost:9090/-/reload
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `infrastructure/grafana/prometheus.yml` | Prometheus scrape targets and alertmanager config |
| `infrastructure/grafana/alerting-rules.yml` | Prometheus alerting rules |
| `infrastructure/grafana/alertmanager.yml` | Alert routing and notification config |
| `infrastructure/grafana/dashboards/eccs-operations-dashboard.json` | Operations dashboard |
| `infrastructure/grafana/dashboards/eccs-dashboard.json` | Main dashboard |

---

## Environment Variables

Set these environment variables for notification channels:

| Variable | Purpose |
|----------|---------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |
| `PAGERDUTY_SERVICE_KEY` | PagerDuty service integration key |
| `INCIDENT_WEBHOOK_URL` | Custom incident webhook URL |
| `SMTP_HOST` | SMTP server for email notifications |
| `SMTP_PORT` | SMTP port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |

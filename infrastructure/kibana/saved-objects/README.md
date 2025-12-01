# ECCS Kibana Saved Objects

This directory contains pre-configured Kibana saved objects for monitoring the ECCS email processing system.

## Contents

### Data Views

| File | Description |
|------|-------------|
| `index-patterns.ndjson` | General logs data view (`eccs-logs-*`) for real-time log ingestion |
| `email-dashboards.ndjson` | Contains data views for MongoDB logs: `eccs-email-logs-*` and `eccs-app-logs-*` |

> **Note:** Kibana 8.x renamed "index patterns" to "data views". The saved objects in this directory use the `data-view` type for compatibility with Kibana 8.x+.

### Dashboards

#### [ECCS] Email Processing Dashboard

A comprehensive dashboard for monitoring email delivery performance, including:

1. **Overview Metrics** (Top Row)
   - Total Emails Processed
   - Average Latency (ms)
   - Failed Email Count
   - Dead Letter Queue Count

2. **Error Analysis**
   - Error Rate Over Time (line chart comparing failed vs successful)
   - Error Category Breakdown (pie chart: network, auth, recipient_rejected, etc.)
   - Status Distribution (donut chart)

3. **Latency Analysis**
   - Latency Percentiles (p50, p90, p99 over time)
   - Latency Distribution Histogram
   - Latency Bucket Breakdown (fast, normal, slow, critical)

4. **Retry Analysis**
   - Retry Rate Over Time (retried vs first-attempt)
   - Retry Count by Attempt Number (pie chart)

5. **Provider Performance**
   - Average Latency by Provider (SMTP, SES, SendGrid)
   - Success/Failure rates by provider

## How to Import

### Method 1: Kibana UI

1. Navigate to Kibana: `http://localhost:5601`
2. Go to **Stack Management** > **Saved Objects**
3. Click **Import**
4. Select the `.ndjson` files to import
5. Click **Import** to complete

Import order:
1. `index-patterns.ndjson` (creates data views first)
2. `email-dashboards.ndjson` (creates data views, visualizations, and dashboard)

### Method 2: Kibana API

```bash
# Import data views
curl -X POST "http://localhost:5601/api/saved_objects/_import?overwrite=true" \
  -H "kbn-xsrf: true" \
  --form file=@index-patterns.ndjson

# Import dashboards and visualizations
curl -X POST "http://localhost:5601/api/saved_objects/_import?overwrite=true" \
  -H "kbn-xsrf: true" \
  --form file=@email-dashboards.ndjson
```

### Method 3: Docker/Podman Script

Create a script to import on container startup:

```bash
#!/bin/bash
# wait-for-kibana.sh

# Wait for Kibana to be ready
until curl -s "http://localhost:5601/api/status" | grep -q '"level":"available"'; do
  echo "Waiting for Kibana..."
  sleep 5
done

# Import saved objects
for file in /kibana/saved-objects/*.ndjson; do
  curl -X POST "http://localhost:5601/api/saved_objects/_import?overwrite=true" \
    -H "kbn-xsrf: true" \
    --form file=@"$file"
done
```

## Query Filters for Kibana Discover

### Error Analysis Queries

```kuery
# All failed or retrying emails
status:failed OR status:retry

# Errors by category
error_category:network
error_category:authentication
error_category:recipient_rejected
error_category:temporary_failure

# Final failures (sent to DLQ)
is_final_failure:true
sentToDlq:true
tags:dlq

# Specific error codes
errorCode:ECONNREFUSED
errorCode:550
```

### Latency Analysis Queries

```kuery
# Slow processing (> 5 seconds)
latencyMs:[5000 TO *]

# By latency bucket
latency_bucket:slow
latency_bucket:critical

# Slow SMTP operations
sendLatencyMs:[3000 TO *]
```

### Retry Analysis Queries

```kuery
# Retried emails (not first attempt)
is_retry:true
attempt:[2 TO *]

# Multiple retry attempts
attempt:[3 TO *]

# Scheduled retries
status:retry AND retryScheduledAt:*
```

### Provider Analysis Queries

```kuery
# By email provider
email_provider:smtp
email_provider:ses
email_provider:sendgrid

# Provider failures
email_provider:ses AND status:failed
```

## Index Mapping Fields

### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `@timestamp` | date | Event timestamp |
| `emailId` | keyword | Unique email identifier |
| `status` | keyword | Processing status (pending, sent, failed, retry) |

### Error Fields

| Field | Type | Description |
|-------|------|-------------|
| `errorMessage` | text | Human-readable error description |
| `errorCode` | keyword | Machine-readable error code |
| `errorStack` | text | Stack trace for debugging |
| `error_category` | keyword | Computed: network, auth, recipient_rejected, etc. |

### Latency Fields

| Field | Type | Description |
|-------|------|-------------|
| `latencyMs` | long | Total processing time (milliseconds) |
| `sendLatencyMs` | long | SMTP send operation time |
| `latency_bucket` | keyword | Computed: fast (<100ms), normal, slow, critical (>2s) |

### Retry Fields

| Field | Type | Description |
|-------|------|-------------|
| `attempt` | integer | Current attempt number (1 = first try) |
| `maxAttempts` | integer | Maximum configured retries |
| `is_retry` | boolean | True if attempt > 1 |
| `is_final_failure` | boolean | True if sent to DLQ |
| `sentToDlq` | boolean | Sent to dead letter queue |
| `retryScheduledAt` | date | Next retry time |
| `backoffDelayMs` | long | Backoff delay for this retry |

### Provider Fields

| Field | Type | Description |
|-------|------|-------------|
| `provider` | keyword | Email provider (smtp, ses, sendgrid) |
| `email_provider` | keyword | Alias for provider |
| `messageId` | keyword | Provider-assigned message ID |
| `recipientEmail` | keyword | Recipient email address |

## Dashboard Customization

### Adding Alerts

1. Navigate to **Observability** > **Alerts**
2. Create new rule based on error rate:
   - Condition: Count of `status:failed` > threshold
   - Time window: 5 minutes
   - Action: Email/Slack notification

### Creating Custom Visualizations

1. Go to **Analytics** > **Visualize Library**
2. Create new visualization
3. Select data view: `eccs-email-logs-*`
4. Choose visualization type
5. Configure aggregations using the fields above

## Troubleshooting

### No Data Appearing

1. Check Logstash pipeline status: `curl localhost:9600/_node/stats/pipelines`
2. Verify MongoDB connection: Check `MONGODB_URI` environment variable
3. Check Elasticsearch indices: `curl localhost:9200/_cat/indices?v`

### Missing Fields

1. Refresh data view in Kibana: Stack Management > Data Views > Refresh
2. Verify Logstash filter processing in pipeline logs
3. Check field mappings: `curl localhost:9200/eccs-email-logs-*/_mapping`

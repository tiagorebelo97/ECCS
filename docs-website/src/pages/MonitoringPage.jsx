import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FiActivity, FiAlertTriangle, FiBarChart2, FiDatabase, FiEye, FiTrendingUp, FiZap, FiBell } from 'react-icons/fi'

// Metric Card Component
function MetricCard({ title, value, change, icon: Icon, color }) {
  return (
    <div className="card" style={{ padding: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-md)',
          backgroundColor: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={20} style={{ color }} />
        </div>
        {change && (
          <span style={{
            fontSize: '0.75rem',
            color: change > 0 ? 'var(--color-success)' : 'var(--color-error)',
            backgroundColor: change > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)'
          }}>
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{value}</div>
    </div>
  )
}

// Dashboard Card
function DashboardCard({ title, description, url, panels }) {
  return (
    <div className="card" style={{ padding: 'var(--space-xl)' }}>
      <h4 style={{ marginBottom: 'var(--space-sm)' }}>{title}</h4>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.875rem' }}>
        {description}
      </p>
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>URL: </span>
        <code style={{ fontSize: '0.75rem' }}>{url}</code>
      </div>
      <div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Panels: </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
          {panels.map(panel => (
            <span 
              key={panel}
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                backgroundColor: 'var(--color-bg)',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              {panel}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Alert Rule Component
function AlertRule({ name, condition, severity, duration, description }) {
  const severityColors = {
    critical: 'var(--color-error)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)'
  }

  return (
    <div className="card" style={{ 
      padding: 'var(--space-lg)',
      borderLeft: `4px solid ${severityColors[severity]}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
        <h5 style={{ margin: 0 }}>{name}</h5>
        <span style={{
          fontSize: '0.75rem',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: `${severityColors[severity]}20`,
          color: severityColors[severity],
          textTransform: 'capitalize'
        }}>
          {severity}
        </span>
      </div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', marginBottom: 'var(--space-sm)' }}>
        {description}
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: '0.75rem' }}>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Condition: </span>
          <code>{condition}</code>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Duration: </span>
          <code>{duration}</code>
        </div>
      </div>
    </div>
  )
}

// Data for the page
const dashboards = [
  {
    title: 'ECCS Operations Dashboard',
    description: 'Comprehensive monitoring with throughput, failures, and queue metrics',
    url: 'http://localhost:3030/d/eccs-operations',
    panels: ['Email Throughput', 'Success Rate', 'Retry Queue', 'DLQ Count', 'P95 Latency', 'Services Up']
  },
  {
    title: '[ECCS] Email Processing Dashboard (Kibana)',
    description: 'Error rates, latency metrics, retry analysis in Kibana',
    url: 'http://localhost:5601',
    panels: ['Error Rate', 'Latency Distribution', 'Retry Analysis', 'Provider Performance']
  }
]

const alertRules = [
  {
    name: 'HighEmailErrorRate',
    condition: 'error_rate > 5%',
    severity: 'critical',
    duration: '2m',
    description: 'Email processing error rate exceeds 5%'
  },
  {
    name: 'HighEmailProcessingLatency',
    condition: 'p95 > 10s',
    severity: 'warning',
    duration: '5m',
    description: '95th percentile processing latency exceeds 10 seconds'
  },
  {
    name: 'HighRetryQueueDepth',
    condition: 'queue > 100',
    severity: 'warning',
    duration: '5m',
    description: 'Retry queue has more than 100 messages'
  },
  {
    name: 'DLQMessagesGrowing',
    condition: 'increase > 10/hour',
    severity: 'critical',
    duration: '5m',
    description: 'Dead Letter Queue is accumulating messages'
  },
  {
    name: 'ServiceDown',
    condition: 'up == 0',
    severity: 'critical',
    duration: '1m',
    description: 'Service is not responding to health checks'
  },
  {
    name: 'HighKafkaConsumerLag',
    condition: 'lag > 1000',
    severity: 'warning',
    duration: '5m',
    description: 'Kafka consumer lag exceeds 1000 messages'
  }
]

const prometheusMetrics = [
  { name: 'emails_processed_total', type: 'Counter', labels: 'status', description: 'Total emails processed' },
  { name: 'email_processing_duration_seconds', type: 'Histogram', labels: 'service', description: 'Email processing latency' },
  { name: 'email_retry_queue_depth', type: 'Gauge', labels: '-', description: 'Current retry queue size' },
  { name: 'http_request_duration_seconds', type: 'Histogram', labels: 'method, route, status', description: 'HTTP request latency' },
  { name: 'kafka_consumergroup_lag', type: 'Gauge', labels: 'topic, partition', description: 'Consumer group lag per partition' }
]

function MonitoringPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div style={{ maxWidth: 1200 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 'var(--space-sm)' }}>Monitoring & Observability</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2xl)', fontSize: '1.125rem' }}>
          Comprehensive monitoring setup with Prometheus, Grafana, ELK Stack, and Jaeger for full observability.
        </p>
      </motion.div>

      {/* Navigation Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ 
          display: 'flex', 
          gap: 'var(--space-sm)', 
          marginBottom: 'var(--space-2xl)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-md)'
        }}
      >
        {['overview', 'dashboards', 'alerts', 'metrics'].map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab)}
            style={{ textTransform: 'capitalize' }}
          >
            {tab}
          </button>
        ))}
      </motion.div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Architecture Diagram */}
          <section style={{ marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Monitoring Architecture</h2>
            <div className="card" style={{ padding: 'var(--space-xl)', overflow: 'auto' }}>
              <pre style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '0.75rem',
                lineHeight: 1.6,
                color: 'var(--color-text-secondary)',
                margin: 0,
                background: 'none',
                border: 'none',
                padding: 0
              }}>
{`┌─────────────────────────────────────────────────────────────────────────────┐
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
│   │                     Observability Stack                                │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐ │  │
│   │  │  Prometheus  │──│ Alertmanager │──│         Grafana              │ │  │
│   │  │    :9091     │  │    :9093     │  │          :3030               │ │  │
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
└─────────────────────────────────────────────────────────────────────────────┘`}
              </pre>
            </div>
          </section>

          {/* Quick Access */}
          <section style={{ marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Quick Access</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-md)'
            }}>
              {[
                { name: 'Grafana', port: 3030, icon: FiBarChart2, color: '#F6AD55' },
                { name: 'Prometheus', port: 9091, icon: FiActivity, color: '#E53E3E' },
                { name: 'Kibana', port: 5601, icon: FiEye, color: '#F687B3' },
                { name: 'Jaeger', port: 16686, icon: FiZap, color: '#4FD1C5' },
                { name: 'Alertmanager', port: 9093, icon: FiBell, color: '#FC8181' }
              ].map(service => (
                <div key={service.name} className="card" style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                  <service.icon size={32} style={{ color: service.color, marginBottom: 'var(--space-sm)' }} />
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{service.name}</div>
                  <code style={{ fontSize: '0.75rem' }}>localhost:{service.port}</code>
                </div>
              ))}
            </div>
          </section>

          {/* Key Features */}
          <section>
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Key Features</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--space-md)'
            }}>
              <div className="card" style={{ padding: 'var(--space-lg)' }}>
                <FiTrendingUp size={24} style={{ color: 'var(--color-primary-light)', marginBottom: 'var(--space-sm)' }} />
                <h4 style={{ marginBottom: 'var(--space-sm)' }}>Metrics Collection</h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                  Prometheus scrapes metrics from all services at /metrics endpoints every 15 seconds
                </p>
              </div>
              <div className="card" style={{ padding: 'var(--space-lg)' }}>
                <FiDatabase size={24} style={{ color: 'var(--color-success)', marginBottom: 'var(--space-sm)' }} />
                <h4 style={{ marginBottom: 'var(--space-sm)' }}>Centralized Logging</h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                  ELK Stack aggregates logs from all services with 90-day retention and ILM policies
                </p>
              </div>
              <div className="card" style={{ padding: 'var(--space-lg)' }}>
                <FiZap size={24} style={{ color: 'var(--color-warning)', marginBottom: 'var(--space-sm)' }} />
                <h4 style={{ marginBottom: 'var(--space-sm)' }}>Distributed Tracing</h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                  Jaeger tracks requests across services with OpenTelemetry protocol support
                </p>
              </div>
              <div className="card" style={{ padding: 'var(--space-lg)' }}>
                <FiAlertTriangle size={24} style={{ color: 'var(--color-error)', marginBottom: 'var(--space-sm)' }} />
                <h4 style={{ marginBottom: 'var(--space-sm)' }}>Intelligent Alerting</h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                  Alertmanager routes alerts with deduplication, grouping, and multi-channel notifications
                </p>
              </div>
            </div>
          </section>
        </motion.div>
      )}

      {/* Dashboards Tab */}
      {activeTab === 'dashboards' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <section style={{ marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Pre-configured Dashboards</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: 'var(--space-lg)'
            }}>
              {dashboards.map(dashboard => (
                <DashboardCard key={dashboard.title} {...dashboard} />
              ))}
            </div>
          </section>

          <section>
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Useful Kibana Filters</h2>
            <div className="card" style={{ padding: 'var(--space-xl)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Filter</th>
                    <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { filter: 'service:email-service', desc: 'Email service logs' },
                    { filter: 'service:auth-service', desc: 'Authentication logs' },
                    { filter: 'service:notification-service', desc: 'Email processing logs' },
                    { filter: 'level:error', desc: 'Show only errors' },
                    { filter: 'status:failed OR status:retry', desc: 'Failed email deliveries' },
                    { filter: 'latencyMs:[5000 TO *]', desc: 'Slow processing (>5 seconds)' },
                    { filter: 'sentToDlq:true', desc: 'Dead letter queue entries' }
                  ].map(item => (
                    <tr key={item.filter} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 'var(--space-md)' }}>
                        <code style={{ fontSize: '0.8125rem' }}>{item.filter}</code>
                      </td>
                      <td style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>{item.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </motion.div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <section style={{ marginBottom: 'var(--space-3xl)' }}>
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Alert Rules</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
              gap: 'var(--space-md)'
            }}>
              {alertRules.map(rule => (
                <AlertRule key={rule.name} {...rule} />
              ))}
            </div>
          </section>

          <section>
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Notification Channels</h2>
            <div className="card" style={{ padding: 'var(--space-xl)' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-lg)'
              }}>
                <div>
                  <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-primary-light)' }}>Slack</h4>
                  <ul style={{ color: 'var(--color-text-secondary)', paddingLeft: 'var(--space-lg)', lineHeight: 1.8, margin: 0 }}>
                    <li>#eccs-alerts (general)</li>
                    <li>#eccs-critical (P1)</li>
                    <li>#email-team (email issues)</li>
                  </ul>
                </div>
                <div>
                  <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-warning)' }}>Email</h4>
                  <ul style={{ color: 'var(--color-text-secondary)', paddingLeft: 'var(--space-lg)', lineHeight: 1.8, margin: 0 }}>
                    <li>oncall@example.com</li>
                    <li>email-ops@example.com</li>
                    <li>management@example.com</li>
                  </ul>
                </div>
                <div>
                  <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-error)' }}>PagerDuty</h4>
                  <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                    Critical incidents requiring immediate response
                  </p>
                </div>
              </div>
            </div>
          </section>
        </motion.div>
      )}

      {/* Metrics Tab */}
      {activeTab === 'metrics' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <section>
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Prometheus Metrics</h2>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                    <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Metric Name</th>
                    <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Labels</th>
                    <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {prometheusMetrics.map((metric, i) => (
                    <tr 
                      key={metric.name} 
                      style={{ 
                        borderBottom: '1px solid var(--color-border)',
                        backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'
                      }}
                    >
                      <td style={{ padding: 'var(--space-md)' }}>
                        <code style={{ fontSize: '0.8125rem' }}>{metric.name}</code>
                      </td>
                      <td style={{ padding: 'var(--space-md)' }}>
                        <span className={`badge badge-${metric.type === 'Counter' ? 'success' : metric.type === 'Gauge' ? 'info' : 'warning'}`}>
                          {metric.type}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                        {metric.labels}
                      </td>
                      <td style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
                        {metric.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </motion.div>
      )}
    </div>
  )
}

export default MonitoringPage

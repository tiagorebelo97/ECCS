import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FiCopy, FiCheck, FiTerminal, FiServer, FiCloud, FiSettings, FiFolder } from 'react-icons/fi'

// Code block with copy
function CodeBlock({ code, title }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      {title && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 'var(--space-sm)'
        }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{title}</span>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <button
          onClick={handleCopy}
          className="btn btn-ghost"
          style={{
            position: 'absolute',
            top: 'var(--space-sm)',
            right: 'var(--space-sm)',
            padding: 'var(--space-xs)',
            zIndex: 1
          }}
        >
          {copied ? <FiCheck size={16} style={{ color: 'var(--color-success)' }} /> : <FiCopy size={16} />}
        </button>
        <pre style={{ 
          backgroundColor: 'var(--color-bg)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-lg)',
          margin: 0,
          overflow: 'auto',
          fontSize: '0.8125rem',
          lineHeight: 1.7,
          border: '1px solid var(--color-border)'
        }}>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}

// Step component
function Step({ number, title, children }) {
  return (
    <div style={{ 
      display: 'flex', 
      gap: 'var(--space-lg)',
      marginBottom: 'var(--space-2xl)'
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        backgroundColor: 'var(--color-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        flexShrink: 0
      }}>
        {number}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ marginBottom: 'var(--space-md)' }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

// Environment variable table
function EnvVarTable({ variables }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Variable</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Description</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Default</th>
          </tr>
        </thead>
        <tbody>
          {variables.map((v, i) => (
            <tr 
              key={v.name} 
              style={{ 
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'
              }}
            >
              <td style={{ padding: 'var(--space-md)' }}>
                <code style={{ fontSize: '0.8125rem' }}>{v.name}</code>
              </td>
              <td style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>{v.description}</td>
              <td style={{ padding: 'var(--space-md)' }}>
                {v.default ? (
                  <code style={{ fontSize: '0.75rem' }}>{v.default}</code>
                ) : (
                  <span style={{ color: 'var(--color-warning)', fontSize: '0.75rem' }}>Required</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const envVariables = [
  { name: 'POSTGRES_PASSWORD', description: 'PostgreSQL database password', default: null },
  { name: 'JWT_SECRET', description: 'Secret key for JWT token signing', default: null },
  { name: 'SMTP_HOST', description: 'SMTP server hostname', default: 'postfix' },
  { name: 'SMTP_PORT', description: 'SMTP server port', default: '25' },
  { name: 'SMTP_USER', description: 'SMTP authentication username', default: '-' },
  { name: 'SMTP_PASS', description: 'SMTP authentication password', default: '-' },
  { name: 'GRAFANA_PASSWORD', description: 'Grafana admin password', default: 'admin123' },
  { name: 'LOGSTASH_HOST', description: 'Logstash server hostname', default: 'logstash' },
  { name: 'LOGSTASH_PORT', description: 'Logstash TCP port', default: '5000' }
]

function DeploymentPage() {
  const [activeTab, setActiveTab] = useState('local')

  return (
    <div style={{ maxWidth: 1000 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 'var(--space-sm)' }}>Deployment Guide</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2xl)', fontSize: '1.125rem' }}>
          Step-by-step instructions for deploying ECCS in different environments.
        </p>
      </motion.div>

      {/* Deployment Type Tabs */}
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
        {[
          { id: 'local', label: 'Local Development', icon: FiTerminal },
          { id: 'kubernetes', label: 'Kubernetes', icon: FiCloud },
          { id: 'production', label: 'Production', icon: FiServer }
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Local Development */}
      {activeTab === 'local' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Step number="1" title="Clone the Repository">
            <CodeBlock code={`git clone https://github.com/tiagorebelo97/ECCS.git
cd ECCS`} />
          </Step>

          <Step number="2" title="Configure Environment">
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
              Copy the example environment file and configure your settings:
            </p>
            <CodeBlock code={`cp .env.example .env

# Edit .env with your configuration
nano .env`} />
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-md)' }}>
              Required environment variables:
            </p>
            <CodeBlock code={`POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_key

# Optional: SMTP configuration for external email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password`} />
          </Step>

          <Step number="3" title="Start All Services">
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
              Use Podman Compose or Docker Compose to start all services:
            </p>
            <CodeBlock code={`# Using Podman
podman-compose up -d

# Or using Docker
docker-compose -f podman-compose.yml up -d`} />
          </Step>

          <Step number="4" title="Verify Services">
            <CodeBlock code={`# Check service status
podman-compose ps

# View logs
podman-compose logs -f email-service

# Test health endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health`} />
          </Step>

          <Step number="5" title="Access Applications">
            <div className="card" style={{ padding: 'var(--space-lg)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--space-sm)', textAlign: 'left' }}>Service</th>
                    <th style={{ padding: 'var(--space-sm)', textAlign: 'left' }}>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { service: 'Frontend', url: 'http://localhost:3000' },
                    { service: 'API Gateway', url: 'http://localhost:8800' },
                    { service: 'Traefik Dashboard', url: 'http://localhost:8080' },
                    { service: 'Grafana', url: 'http://localhost:3030' },
                    { service: 'Kibana', url: 'http://localhost:5601' },
                    { service: 'Jaeger', url: 'http://localhost:16686' },
                    { service: 'Prometheus', url: 'http://localhost:9091' }
                  ].map(item => (
                    <tr key={item.service} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 'var(--space-sm)' }}>{item.service}</td>
                      <td style={{ padding: 'var(--space-sm)' }}>
                        <code style={{ fontSize: '0.8125rem' }}>{item.url}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Step>
        </motion.div>
      )}

      {/* Kubernetes */}
      {activeTab === 'kubernetes' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Step number="1" title="Create Namespace">
            <CodeBlock code={`kubectl create namespace eccs`} />
          </Step>

          <Step number="2" title="Create Secrets">
            <CodeBlock code={`kubectl create secret generic eccs-secrets \\
  --from-literal=postgres-host=postgres \\
  --from-literal=postgres-password=your_password \\
  --from-literal=jwt-secret=your_jwt_secret \\
  --from-literal=mongodb-uri=mongodb://mongodb:27017/eccs_logs \\
  -n eccs`} />
          </Step>

          <Step number="3" title="Deploy Applications">
            <CodeBlock code={`kubectl apply -f infrastructure/kubernetes/ -n eccs`} />
          </Step>

          <Step number="4" title="Verify Deployment">
            <CodeBlock code={`# Check pods
kubectl get pods -n eccs

# Check services
kubectl get svc -n eccs

# Check Horizontal Pod Autoscaler
kubectl get hpa -n eccs`} />
          </Step>

          <Step number="5" title="Access via Port-Forward">
            <CodeBlock code={`# Frontend
kubectl port-forward svc/frontend 3000:3000 -n eccs

# Grafana
kubectl port-forward svc/grafana 3030:3000 -n eccs`} />
          </Step>
        </motion.div>
      )}

      {/* Production */}
      {activeTab === 'production' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="card" style={{ 
            padding: 'var(--space-xl)',
            marginBottom: 'var(--space-2xl)',
            borderLeft: '4px solid var(--color-warning)'
          }}>
            <h3 style={{ marginBottom: 'var(--space-md)', color: 'var(--color-warning)' }}>
              ⚠️ Production Checklist
            </h3>
            <ul style={{ color: 'var(--color-text-secondary)', lineHeight: 2, paddingLeft: 'var(--space-lg)' }}>
              <li>Use strong, unique passwords for all services</li>
              <li>Configure TLS certificates (use Let's Encrypt or CA-signed)</li>
              <li>Enable HTTPS redirect in Traefik</li>
              <li>Restrict Traefik dashboard access</li>
              <li>Configure specific CORS origins</li>
              <li>Set up database replication for high availability</li>
              <li>Configure automated backups</li>
              <li>Set up proper alerting and monitoring</li>
              <li>Review and adjust rate limits for your traffic patterns</li>
            </ul>
          </div>

          <h2 style={{ marginBottom: 'var(--space-lg)' }}>High Availability Setup</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-2xl)'
          }}>
            <div className="card" style={{ padding: 'var(--space-lg)' }}>
              <h4 style={{ marginBottom: 'var(--space-sm)' }}>Database Replication</h4>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                Set up PostgreSQL streaming replication and MongoDB replica sets for data redundancy
              </p>
            </div>
            <div className="card" style={{ padding: 'var(--space-lg)' }}>
              <h4 style={{ marginBottom: 'var(--space-sm)' }}>Multi-Zone Deployment</h4>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                Deploy across multiple availability zones for fault tolerance
              </p>
            </div>
            <div className="card" style={{ padding: 'var(--space-lg)' }}>
              <h4 style={{ marginBottom: 'var(--space-sm)' }}>Load Balancing</h4>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                Configure Traefik with multiple backend instances for horizontal scaling
              </p>
            </div>
            <div className="card" style={{ padding: 'var(--space-lg)' }}>
              <h4 style={{ marginBottom: 'var(--space-sm)' }}>Backup Automation</h4>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                Schedule regular backups using provided scripts with cron jobs
              </p>
            </div>
          </div>

          <h2 style={{ marginBottom: 'var(--space-lg)' }}>Backup & Recovery</h2>
          <CodeBlock 
            title="Automated Daily Backup (crontab)"
            code={`# Add to crontab for daily backups at 2 AM
0 2 * * * /path/to/ECCS/scripts/backup.sh >> /var/log/eccs-backup.log 2>&1`} 
          />
          <CodeBlock 
            title="Manual Backup"
            code={`./scripts/backup.sh`} 
          />
          <CodeBlock 
            title="Restore from Backup"
            code={`# List available backups
ls /backups/

# Restore specific backup
./scripts/restore.sh 20240115_020000`} 
          />
        </motion.div>
      )}

      {/* Environment Variables */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ marginTop: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Environment Variables</h2>
        <EnvVarTable variables={envVariables} />
      </motion.section>

      {/* Project Structure */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{ marginTop: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>
          <FiFolder style={{ marginRight: 'var(--space-sm)' }} />
          Project Structure
        </h2>
        <div className="card" style={{ padding: 'var(--space-xl)' }}>
          <pre style={{ 
            margin: 0, 
            background: 'none', 
            border: 'none',
            padding: 0,
            fontSize: '0.8125rem',
            lineHeight: 1.8
          }}>
{`ECCS/
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
├── docs/                       # Documentation
├── podman-compose.yml          # Container orchestration
└── README.md`}
          </pre>
        </div>
      </motion.section>
    </div>
  )
}

export default DeploymentPage

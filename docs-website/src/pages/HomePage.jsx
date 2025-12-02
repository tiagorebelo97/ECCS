import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiArrowRight, FiGithub, FiBookOpen, FiZap, FiShield, FiActivity, FiBox, FiServer, FiDatabase } from 'react-icons/fi'
import { services, portSummary } from '../data/services'

const features = [
  {
    icon: FiServer,
    title: 'Microservices Architecture',
    description: 'Fully containerized with 17+ services working together seamlessly',
    color: '#68D391'
  },
  {
    icon: FiShield,
    title: 'Enterprise Security',
    description: 'JWT authentication, rate limiting, TLS encryption, and security headers',
    color: '#F6AD55'
  },
  {
    icon: FiActivity,
    title: 'Full Observability',
    description: 'Complete monitoring with ELK stack, Prometheus, Grafana, and Jaeger tracing',
    color: '#FC8181'
  },
  {
    icon: FiZap,
    title: 'High Performance',
    description: 'Kafka-powered async processing with automatic retries and DLQ handling',
    color: '#9F7AEA'
  },
  {
    icon: FiDatabase,
    title: 'Robust Data Layer',
    description: 'PostgreSQL for structured data, MongoDB for logs and audit trails',
    color: '#4299E1'
  },
  {
    icon: FiBox,
    title: 'Cloud Native',
    description: 'Podman/Docker compatible with Kubernetes deployment configurations',
    color: '#F687B3'
  }
]

const quickStats = [
  { value: '17+', label: 'Containers', icon: FiServer },
  { value: '6', label: 'API Endpoints', icon: FiBookOpen },
  { value: '5', label: 'Dashboards', icon: FiActivity },
  { value: '15+', label: 'Alert Rules', icon: FiShield }
]

function HomePage() {
  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <div style={{ 
          display: 'inline-block',
          padding: 'var(--space-xs) var(--space-md)',
          background: 'rgba(99, 102, 241, 0.2)',
          borderRadius: 'var(--radius-full)',
          marginBottom: 'var(--space-lg)',
          fontSize: '0.875rem',
          color: 'var(--color-primary-light)'
        }}>
          🚀 Enterprise Cloud Communication System
        </div>
        
        <h1 style={{ 
          fontSize: '3.5rem', 
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: 'var(--space-lg)',
          background: 'linear-gradient(135deg, var(--color-text) 0%, var(--color-primary-light) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          ECCS Documentation
        </h1>
        
        <p style={{ 
          fontSize: '1.25rem', 
          color: 'var(--color-text-secondary)',
          maxWidth: 700,
          marginBottom: 'var(--space-xl)'
        }}>
          A fully containerized microservices email system built with modern cloud-native technologies. 
          Complete with authentication, message queuing, observability, and more.
        </p>
        
        <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <Link to="/architecture" className="btn btn-primary" style={{ padding: 'var(--space-md) var(--space-xl)', fontSize: '1rem' }}>
            Explore Architecture
            <FiArrowRight />
          </Link>
          <Link to="/services" className="btn btn-secondary" style={{ padding: 'var(--space-md) var(--space-xl)', fontSize: '1rem' }}>
            View Services
          </Link>
        </div>
      </motion.section>

      {/* Quick Stats */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--space-md)'
        }}>
          {quickStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="card"
              style={{ textAlign: 'center', padding: 'var(--space-xl)' }}
            >
              <stat.icon size={24} style={{ color: 'var(--color-primary-light)', marginBottom: 'var(--space-sm)' }} />
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Architecture Preview */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Architecture Overview</h2>
        
        <div className="card" style={{ 
          padding: 'var(--space-xl)',
          background: 'linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg) 100%)',
          border: '1px solid var(--color-border)',
          overflow: 'auto'
        }}>
          <pre style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: '0.75rem',
            lineHeight: 1.5,
            color: 'var(--color-text-secondary)',
            whiteSpace: 'pre',
            margin: 0,
            background: 'none',
            border: 'none',
            padding: 0
          }}>
{`┌─────────────────────────────────────────────────────────────────────────────┐
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
└─────────────────────────────────────────────────────────────────────────────┘`}
          </pre>
        </div>
        
        <Link 
          to="/architecture" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 'var(--space-sm)',
            marginTop: 'var(--space-lg)',
            color: 'var(--color-primary-light)'
          }}
        >
          View Interactive Architecture <FiArrowRight />
        </Link>
      </motion.section>

      {/* Features Grid */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Key Features</h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-lg)'
        }}>
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="card"
              style={{ padding: 'var(--space-xl)' }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-lg)',
                backgroundColor: `${feature.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-md)'
              }}>
                <feature.icon size={24} style={{ color: feature.color }} />
              </div>
              <h3 style={{ marginBottom: 'var(--space-sm)', fontSize: '1.125rem' }}>{feature.title}</h3>
              <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.9375rem' }}>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Quick Access */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Quick Access</h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-md)'
        }}>
          <Link to="/flows" className="card card-interactive" style={{ padding: 'var(--space-lg)', textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <span style={{ fontSize: '2rem' }}>🔄</span>
              <div>
                <h4 style={{ margin: 0 }}>Flow Examples</h4>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Interactive workflow diagrams</p>
              </div>
              <FiArrowRight style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)' }} />
            </div>
          </Link>
          
          <Link to="/api" className="card card-interactive" style={{ padding: 'var(--space-lg)', textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <span style={{ fontSize: '2rem' }}>📚</span>
              <div>
                <h4 style={{ margin: 0 }}>API Reference</h4>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Complete API documentation</p>
              </div>
              <FiArrowRight style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)' }} />
            </div>
          </Link>
          
          <Link to="/monitoring" className="card card-interactive" style={{ padding: 'var(--space-lg)', textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <span style={{ fontSize: '2rem' }}>📊</span>
              <div>
                <h4 style={{ margin: 0 }}>Monitoring</h4>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Dashboards and alerting</p>
              </div>
              <FiArrowRight style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)' }} />
            </div>
          </Link>
          
          <Link to="/deployment" className="card card-interactive" style={{ padding: 'var(--space-lg)', textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <span style={{ fontSize: '2rem' }}>🚀</span>
              <div>
                <h4 style={{ margin: 0 }}>Deployment</h4>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Setup and configuration</p>
              </div>
              <FiArrowRight style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)' }} />
            </div>
          </Link>
        </div>
      </motion.section>

      {/* Port Summary Table */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Service Ports</h2>
        
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '0.875rem'
          }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontWeight: 600 }}>Service</th>
                <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontWeight: 600 }}>Port</th>
                <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontWeight: 600 }}>Protocol</th>
                <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontWeight: 600 }}>Access</th>
              </tr>
            </thead>
            <tbody>
              {portSummary.slice(0, 8).map((item, i) => (
                <tr 
                  key={item.service + item.port} 
                  style={{ 
                    borderBottom: '1px solid var(--color-border)',
                    backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'
                  }}
                >
                  <td style={{ padding: 'var(--space-md)' }}>{item.service}</td>
                  <td style={{ padding: 'var(--space-md)' }}>
                    <code style={{ 
                      backgroundColor: 'var(--color-bg-tertiary)', 
                      padding: '2px 8px', 
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem'
                    }}>
                      {item.port}
                    </code>
                  </td>
                  <td style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>{item.protocol}</td>
                  <td style={{ padding: 'var(--space-md)' }}>
                    <span className={`badge ${item.access === 'Public' ? 'badge-success' : 'badge-info'}`}>
                      {item.access}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <Link 
          to="/services" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 'var(--space-sm)',
            marginTop: 'var(--space-lg)',
            color: 'var(--color-primary-light)'
          }}
        >
          View all services and ports <FiArrowRight />
        </Link>
      </motion.section>

      {/* Getting Started */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <div className="card" style={{ 
          padding: 'var(--space-2xl)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)'
        }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>Getting Started</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
            Clone the repository and start all services with a single command:
          </p>
          
          <pre style={{ 
            backgroundColor: 'var(--color-bg)',
            padding: 'var(--space-lg)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-lg)',
            overflow: 'auto'
          }}>
            <code style={{ color: 'var(--color-text)' }}>{`# Clone the repository
git clone https://github.com/tiagorebelo97/ECCS.git
cd ECCS

# Configure environment
cp .env.example .env

# Start all services
podman-compose up -d

# Access the application
open http://localhost:3000`}</code>
          </pre>
          
          <Link to="/deployment" className="btn btn-primary">
            View Full Deployment Guide <FiArrowRight />
          </Link>
        </div>
      </motion.section>
    </div>
  )
}

export default HomePage

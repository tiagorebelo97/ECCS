import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FiCopy, FiCheck, FiLock, FiUnlock, FiChevronDown, FiChevronUp } from 'react-icons/fi'

// Code block with copy functionality
function CodeBlock({ code, language = 'json' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 'var(--space-lg)' }}>
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
        lineHeight: 1.7
      }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

// Endpoint documentation component
function EndpointDoc({ method, path, description, auth, requestBody, response }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const methodColors = {
    GET: 'var(--color-success)',
    POST: 'var(--color-info)',
    PUT: 'var(--color-warning)',
    DELETE: 'var(--color-error)'
  }

  return (
    <div 
      className="card"
      style={{ 
        marginBottom: 'var(--space-md)',
        overflow: 'hidden'
      }}
    >
      {/* Header - always visible */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          padding: 'var(--space-lg)',
          cursor: 'pointer'
        }}
      >
        <span style={{
          padding: '4px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          fontWeight: 700,
          backgroundColor: `${methodColors[method]}20`,
          color: methodColors[method]
        }}>
          {method}
        </span>
        
        <code style={{ 
          fontSize: '0.9375rem',
          fontWeight: 500,
          color: 'var(--color-text)'
        }}>
          {path}
        </code>
        
        {auth ? (
          <FiLock size={14} style={{ color: 'var(--color-warning)' }} title="Authentication required" />
        ) : (
          <FiUnlock size={14} style={{ color: 'var(--color-success)' }} title="Public endpoint" />
        )}
        
        <span style={{ 
          flex: 1,
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
          textAlign: 'right'
        }}>
          {description}
        </span>
        
        {isExpanded ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          style={{
            padding: 'var(--space-lg)',
            paddingTop: 0,
            borderTop: '1px solid var(--color-border)'
          }}
        >
          <div style={{ paddingTop: 'var(--space-lg)' }}>
            {requestBody && (
              <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h5 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-text-secondary)' }}>
                  Request Body
                </h5>
                <CodeBlock code={requestBody} language="json" />
              </div>
            )}
            
            {response && (
              <div>
                <h5 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-text-secondary)' }}>
                  Response
                </h5>
                <CodeBlock code={response} language="json" />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// API endpoints data
const authEndpoints = [
  {
    method: 'POST',
    path: '/api/auth/register',
    description: 'Register new user',
    auth: false,
    requestBody: `{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}`,
    response: `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}`
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    description: 'Authenticate user',
    auth: false,
    requestBody: `{
  "email": "user@example.com",
  "password": "securePassword123"
}`,
    response: `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}`
  },
  {
    method: 'GET',
    path: '/api/auth/verify',
    description: 'Verify JWT token',
    auth: true,
    response: `{
  "valid": true,
  "user": {
    "userId": 1,
    "email": "user@example.com"
  }
}`
  },
  {
    method: 'POST',
    path: '/api/auth/refresh',
    description: 'Refresh JWT token',
    auth: true,
    response: `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`
  }
]

const emailEndpoints = [
  {
    method: 'GET',
    path: '/api/emails/stats',
    description: 'Get email statistics',
    auth: true,
    response: `{
  "totalEmails": 150,
  "sentToday": 12,
  "pending": 3,
  "failed": 1
}`
  },
  {
    method: 'GET',
    path: '/api/emails',
    description: 'List all user emails',
    auth: true,
    response: `[
  {
    "id": 1,
    "user_id": 1,
    "recipient": "recipient@example.com",
    "subject": "Hello World",
    "body": "This is a test email",
    "status": "sent",
    "created_at": "2024-01-15T10:30:00Z",
    "sent_at": "2024-01-15T10:30:05Z"
  }
]`
  },
  {
    method: 'POST',
    path: '/api/emails/send',
    description: 'Queue email for sending',
    auth: true,
    requestBody: `{
  "to": "recipient@example.com",
  "subject": "Hello World",
  "body": "This is a test email"
}`,
    response: `{
  "message": "Email queued for sending",
  "email": {
    "id": 1,
    "user_id": 1,
    "recipient": "recipient@example.com",
    "subject": "Hello World",
    "body": "This is a test email",
    "status": "pending",
    "created_at": "2024-01-15T10:30:00Z"
  }
}`
  },
  {
    method: 'GET',
    path: '/api/emails/:id',
    description: 'Get specific email',
    auth: true,
    response: `{
  "id": 1,
  "user_id": 1,
  "recipient": "recipient@example.com",
  "subject": "Hello World",
  "body": "This is a test email",
  "status": "sent",
  "created_at": "2024-01-15T10:30:00Z",
  "sent_at": "2024-01-15T10:30:05Z"
}`
  }
]

const errorResponses = [
  {
    code: '400',
    title: 'Bad Request',
    description: 'Invalid request body or parameters',
    example: `{
  "errors": [
    {
      "field": "email",
      "message": "Valid email required"
    }
  ]
}`
  },
  {
    code: '401',
    title: 'Unauthorized',
    description: 'Invalid or expired token',
    example: `{
  "error": "Invalid or expired token"
}`
  },
  {
    code: '404',
    title: 'Not Found',
    description: 'Resource not found',
    example: `{
  "error": "Email not found"
}`
  },
  {
    code: '429',
    title: 'Too Many Requests',
    description: 'Rate limit exceeded',
    example: `{
  "error": "Too many requests",
  "retryAfter": 60
}`
  },
  {
    code: '500',
    title: 'Internal Server Error',
    description: 'Server-side error',
    example: `{
  "error": "Internal server error"
}`
  }
]

function ApiPage() {
  return (
    <div style={{ maxWidth: 1000 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 'var(--space-sm)' }}>API Reference</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2xl)', fontSize: '1.125rem' }}>
          Complete REST API documentation for the ECCS backend services.
        </p>
      </motion.div>

      {/* Authentication Overview */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Authentication</h2>
        <div className="card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
          <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
            All API endpoints (except auth endpoints) require a valid JWT token in the Authorization header:
          </p>
          <CodeBlock code={`Authorization: Bearer <token>`} />
          
          <div style={{ 
            display: 'flex', 
            gap: 'var(--space-lg)',
            marginTop: 'var(--space-lg)',
            padding: 'var(--space-md)',
            backgroundColor: 'var(--color-bg)',
            borderRadius: 'var(--radius-md)',
            flexWrap: 'wrap'
          }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Base URL</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>http://localhost:8800</div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Token Expiration</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>1 hour</div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Rate Limit</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>100 req/min</div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Auth Service Endpoints */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-md)' }}>Auth Service</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
          Authentication and user management endpoints. Port: <code>3002</code>
        </p>
        
        {authEndpoints.map((endpoint, i) => (
          <motion.div
            key={endpoint.path}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
          >
            <EndpointDoc {...endpoint} />
          </motion.div>
        ))}
      </motion.section>

      {/* Email Service Endpoints */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-md)' }}>Email Service</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
          Email management and sending endpoints. Port: <code>3001</code>
        </p>
        
        {emailEndpoints.map((endpoint, i) => (
          <motion.div
            key={endpoint.path + endpoint.method}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.05 }}
          >
            <EndpointDoc {...endpoint} />
          </motion.div>
        ))}
      </motion.section>

      {/* Error Responses */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Error Responses</h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-md)'
        }}>
          {errorResponses.map((error, i) => (
            <motion.div
              key={error.code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              className="card"
              style={{ padding: 'var(--space-lg)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: error.code.startsWith('4') ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: error.code.startsWith('4') ? 'var(--color-warning)' : 'var(--color-error)'
                }}>
                  {error.code}
                </span>
                <span style={{ fontWeight: 600 }}>{error.title}</span>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-md)' }}>
                {error.description}
              </p>
              <pre style={{ 
                backgroundColor: 'var(--color-bg)',
                padding: 'var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                margin: 0,
                overflow: 'auto'
              }}>
                <code>{error.example}</code>
              </pre>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Health Endpoints */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Health & Metrics Endpoints</h2>
        
        <div className="card" style={{ padding: 'var(--space-xl)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Service</th>
                <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Health</th>
                <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Metrics</th>
              </tr>
            </thead>
            <tbody>
              {[
                { service: 'Email Service', port: 3001 },
                { service: 'Auth Service', port: 3002 },
                { service: 'Notification Service', port: 3003 }
              ].map(svc => (
                <tr key={svc.service} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--space-md)' }}>{svc.service}</td>
                  <td style={{ padding: 'var(--space-md)' }}>
                    <code style={{ fontSize: '0.8125rem' }}>GET :{svc.port}/health</code>
                  </td>
                  <td style={{ padding: 'var(--space-md)' }}>
                    <code style={{ fontSize: '0.8125rem' }}>GET :{svc.port}/metrics</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <h4 style={{ marginBottom: 'var(--space-sm)' }}>Health Response</h4>
            <CodeBlock code={`{
  "status": "healthy",
  "service": "email-service"
}`} />
          </div>
        </div>
      </motion.section>

      {/* Kafka Message Schema */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Kafka Message Schemas</h2>
        
        <div className="card" style={{ padding: 'var(--space-xl)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>Email Request Message</h4>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            Messages published to the <code>email_requests</code> topic:
          </p>
          <CodeBlock code={`{
  "id": "uuid-v4-string",
  "to": "recipient@example.com",
  "subject": "Email subject line",
  "body": "Plain text or HTML email body content",
  "userId": "user-identifier",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "email-service-api",
  "metadata": {
    "clientVersion": "1.0.0",
    "environment": "production"
  }
}`} />

          <h4 style={{ marginBottom: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>Dead Letter Queue Message</h4>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            Messages in the <code>email_dlq</code> topic after max retries:
          </p>
          <CodeBlock code={`{
  "originalData": {
    "id": "uuid",
    "to": "recipient@example.com",
    "subject": "Subject",
    "body": "Content",
    "userId": "user-id",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "dlqMetadata": {
    "failureReason": "Max retries exceeded: Connection refused",
    "failedAt": "2024-01-15T10:45:00.000Z",
    "totalAttempts": 5,
    "maxAttemptsConfigured": 5,
    "originalTopic": "email_requests"
  }
}`} />
        </div>
      </motion.section>
    </div>
  )
}

export default ApiPage

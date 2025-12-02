import React from 'react'
import { motion } from 'framer-motion'
import { FiShield, FiLock, FiKey, FiAlertTriangle, FiServer, FiCheckCircle, FiXCircle } from 'react-icons/fi'

// Security Feature Card
function SecurityFeature({ icon: Icon, title, description, status, color }) {
  return (
    <div className="card" style={{ 
      padding: 'var(--space-lg)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-md)',
          backgroundColor: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon size={20} style={{ color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
            <h4 style={{ margin: 0 }}>{title}</h4>
            {status === 'enabled' && <FiCheckCircle size={16} style={{ color: 'var(--color-success)' }} />}
            {status === 'optional' && <span style={{ fontSize: '0.75rem', color: 'var(--color-warning)' }}>Optional</span>}
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

// Security Headers Table
function SecurityHeadersTable() {
  const headers = [
    { header: 'X-Frame-Options', value: 'DENY', protection: 'Clickjacking' },
    { header: 'X-Content-Type-Options', value: 'nosniff', protection: 'MIME sniffing' },
    { header: 'X-XSS-Protection', value: '1; mode=block', protection: 'XSS attacks' },
    { header: 'Strict-Transport-Security', value: 'max-age=31536000', protection: 'Downgrade attacks' },
    { header: 'Referrer-Policy', value: 'strict-origin-when-cross-origin', protection: 'Referer leakage' },
    { header: 'Permissions-Policy', value: 'geolocation=(), microphone=()', protection: 'Feature abuse' }
  ]

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Header</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Value</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Protection</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h, i) => (
            <tr 
              key={h.header} 
              style={{ 
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'
              }}
            >
              <td style={{ padding: 'var(--space-md)' }}>
                <code style={{ fontSize: '0.8125rem' }}>{h.header}</code>
              </td>
              <td style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                {h.value}
              </td>
              <td style={{ padding: 'var(--space-md)' }}>
                <span className="badge badge-info">{h.protection}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Rate Limit Table
function RateLimitTable() {
  const limits = [
    { tier: 'Standard API', average: '100 req/min', burst: '50', useCase: 'Regular API endpoints' },
    { tier: 'Auth Endpoints', average: '20 req/min', burst: '10', useCase: 'Login, registration' },
    { tier: 'Strict', average: '10 req/min', burst: '5', useCase: 'Sensitive operations' },
    { tier: 'Global', average: '500 req/min', burst: '100', useCase: 'DDoS protection' }
  ]

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Tier</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Average Rate</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Burst</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Use Case</th>
          </tr>
        </thead>
        <tbody>
          {limits.map((l, i) => (
            <tr 
              key={l.tier} 
              style={{ 
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'
              }}
            >
              <td style={{ padding: 'var(--space-md)', fontWeight: 600 }}>{l.tier}</td>
              <td style={{ padding: 'var(--space-md)' }}>
                <code style={{ fontSize: '0.8125rem' }}>{l.average}</code>
              </td>
              <td style={{ padding: 'var(--space-md)' }}>
                <code style={{ fontSize: '0.8125rem' }}>{l.burst}</code>
              </td>
              <td style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>{l.useCase}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SecurityPage() {
  return (
    <div style={{ maxWidth: 1000 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 'var(--space-sm)' }}>Security</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2xl)', fontSize: '1.125rem' }}>
          Comprehensive security architecture for the ECCS platform including authentication, encryption, and DDoS protection.
        </p>
      </motion.div>

      {/* Security Overview */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Security Architecture</h2>
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
{`┌─────────────────────────────────────────────────────────────────────┐
│                        Internet                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Traefik API Gateway                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ Rate Limit  │→ │ TLS Termina  │→ │ JWT Auth   │→ │  Router   │  │
│  │  (DDoS)     │  │    tion      │  │ (Forward)  │  │           │  │
│  └─────────────┘  └──────────────┘  └────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Auth Service   │       │  Email Service  │       │  Notification   │
│   (Port 3002)   │       │   (Port 3001)   │       │    Service      │
│  ┌───────────┐  │       │  ┌───────────┐  │       └─────────────────┘
│  │  bcrypt   │  │       │  │   Input   │  │
│  │ password  │  │       │  │ validation│  │
│  │  hashing  │  │       │  └───────────┘  │
│  └───────────┘  │       └─────────────────┘
└─────────────────┘`}
          </pre>
        </div>
      </motion.section>

      {/* Security Features Grid */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Security Features</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: 'var(--space-md)'
        }}>
          <SecurityFeature
            icon={FiKey}
            title="JWT Authentication"
            description="Stateless token-based authentication with configurable expiration and ForwardAuth middleware"
            status="enabled"
            color="var(--color-primary-light)"
          />
          <SecurityFeature
            icon={FiLock}
            title="Password Hashing"
            description="bcrypt algorithm with configurable salt rounds for secure password storage"
            status="enabled"
            color="var(--color-success)"
          />
          <SecurityFeature
            icon={FiShield}
            title="Rate Limiting"
            description="Multi-tier rate limiting per IP address to prevent brute force and DDoS attacks"
            status="enabled"
            color="var(--color-warning)"
          />
          <SecurityFeature
            icon={FiServer}
            title="TLS Encryption"
            description="TLS 1.2+ with strong cipher suites for all external traffic"
            status="optional"
            color="var(--color-info)"
          />
        </div>
      </motion.section>

      {/* JWT Authentication */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>JWT Authentication</h2>
        <div className="card" style={{ padding: 'var(--space-xl)' }}>
          <h4 style={{ marginBottom: 'var(--space-md)' }}>Token Validation Flow</h4>
          <div style={{ 
            backgroundColor: 'var(--color-bg)',
            padding: 'var(--space-lg)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-xl)'
          }}>
            <ol style={{ 
              color: 'var(--color-text-secondary)', 
              lineHeight: 2,
              paddingLeft: 'var(--space-lg)',
              margin: 0
            }}>
              <li>Client sends request with <code>Authorization: Bearer &lt;token&gt;</code></li>
              <li>Traefik intercepts and forwards to auth-service <code>/api/auth/verify</code></li>
              <li>Auth service validates token signature using shared <code>JWT_SECRET</code></li>
              <li>Auth service checks token expiration (<code>exp</code> claim)</li>
              <li>If valid: Returns <code>200 OK</code> with user identity headers</li>
              <li>If invalid: Returns <code>401 Unauthorized</code></li>
              <li>Traefik forwards request to upstream service with <code>X-User-*</code> headers</li>
            </ol>
          </div>

          <h4 style={{ marginBottom: 'var(--space-md)' }}>Token Claims</h4>
          <div className="card" style={{ padding: 0, overflow: 'hidden', backgroundColor: 'var(--color-bg)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Claim</th>
                  <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Description</th>
                  <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}>Required</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { claim: 'userId', desc: 'Numeric user identifier', required: true },
                  { claim: 'email', desc: "User's email address", required: true },
                  { claim: 'exp', desc: 'Expiration timestamp', required: true },
                  { claim: 'iat', desc: 'Issued-at timestamp', required: false },
                  { claim: 'role', desc: 'User role for authorization', required: false }
                ].map((c, i) => (
                  <tr key={c.claim} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: 'var(--space-md)' }}>
                      <code style={{ fontSize: '0.8125rem' }}>{c.claim}</code>
                    </td>
                    <td style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>{c.desc}</td>
                    <td style={{ padding: 'var(--space-md)' }}>
                      {c.required ? (
                        <FiCheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                      ) : (
                        <FiXCircle size={16} style={{ color: 'var(--color-text-muted)' }} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ 
            marginTop: 'var(--space-xl)',
            padding: 'var(--space-lg)',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-primary)'
          }}>
            <h5 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-primary-light)' }}>
              🔒 Security Recommendations
            </h5>
            <ul style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, paddingLeft: 'var(--space-lg)', margin: 0 }}>
              <li>Generate strong JWT secrets: <code>openssl rand -base64 32</code></li>
              <li>Use short token lifetime (default: 1 hour) to limit exposure</li>
              <li>Rotate secrets periodically in production</li>
              <li>Always use HTTPS to prevent token interception</li>
            </ul>
          </div>
        </div>
      </motion.section>

      {/* Rate Limiting */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Rate Limiting (DDoS Prevention)</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
          Multi-tier rate limiting prevents various attack vectors including volumetric DDoS, brute force attacks, and API abuse.
        </p>
        <RateLimitTable />

        <div style={{ 
          marginTop: 'var(--space-xl)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--space-md)'
        }}>
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <h5 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-error)' }}>🛡️ Volumetric DDoS</h5>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Global rate limit blocks high-volume attacks before they reach services
            </p>
          </div>
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <h5 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-warning)' }}>🔐 Brute Force</h5>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Auth rate limit restricts login attempts per IP address
            </p>
          </div>
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <h5 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-info)' }}>📊 API Abuse</h5>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Standard rate limit prevents resource exhaustion
            </p>
          </div>
        </div>
      </motion.section>

      {/* TLS Configuration */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>TLS Configuration</h2>
        <div className="card" style={{ padding: 'var(--space-xl)' }}>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-lg)',
            marginBottom: 'var(--space-xl)'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Minimum Version</div>
              <div style={{ fontWeight: 600 }}>TLS 1.2</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Maximum Version</div>
              <div style={{ fontWeight: 600 }}>TLS 1.3</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Key Exchange</div>
              <div style={{ fontWeight: 600 }}>ECDHE (Forward Secrecy)</div>
            </div>
          </div>

          <h5 style={{ marginBottom: 'var(--space-sm)' }}>Supported Cipher Suites</h5>
          <div style={{ 
            backgroundColor: 'var(--color-bg)',
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
            lineHeight: 1.8
          }}>
            <div>TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384</div>
            <div>TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305</div>
            <div>TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256</div>
            <div>TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384</div>
            <div>TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305</div>
          </div>
        </div>
      </motion.section>

      {/* Security Headers */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        style={{ marginBottom: 'var(--space-3xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Security Headers</h2>
        <SecurityHeadersTable />
      </motion.section>

      {/* Production Checklist */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Production Security Checklist</h2>
        <div className="card" style={{ 
          padding: 'var(--space-xl)',
          borderLeft: '4px solid var(--color-warning)'
        }}>
          <ul style={{ 
            listStyle: 'none',
            padding: 0,
            margin: 0
          }}>
            {[
              'Replace self-signed certificates with CA-signed certificates',
              'Enable HTTPS redirect (sslRedirect: true)',
              'Restrict Traefik dashboard access (remove api.insecure=true)',
              'Configure specific CORS origins instead of wildcard',
              'Set strong JWT_SECRET in environment variables',
              'Review and adjust rate limits for your traffic patterns',
              'Enable Let\'s Encrypt for automatic certificate renewal',
              'Set up database encryption at rest',
              'Configure network policies in Kubernetes',
              'Enable audit logging for compliance'
            ].map((item, i) => (
              <li 
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  padding: 'var(--space-sm) 0',
                  borderBottom: i < 9 ? '1px solid var(--color-border)' : 'none'
                }}
              >
                <input 
                  type="checkbox" 
                  style={{ 
                    width: 18, 
                    height: 18,
                    accentColor: 'var(--color-primary)'
                  }} 
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.section>
    </div>
  )
}

export default SecurityPage

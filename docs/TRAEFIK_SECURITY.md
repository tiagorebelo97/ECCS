# Traefik API Gateway Security Configuration

This document describes the security architecture, configuration rationale, and operational guidelines for the ECCS Traefik API Gateway.

## Table of Contents

1. [Security Overview](#security-overview)
2. [JWT Authentication](#jwt-authentication)
3. [Rate Limiting (DDoS Prevention)](#rate-limiting-ddos-prevention)
4. [TLS Configuration](#tls-configuration)
5. [Dynamic Service Discovery](#dynamic-service-discovery)
6. [Routing Architecture](#routing-architecture)
7. [Security Headers](#security-headers)
8. [Operational Guidelines](#operational-guidelines)

---

## Security Overview

The Traefik API Gateway serves as the single entry point for all external traffic to the ECCS platform. It enforces security policies including:

- **Authentication**: JWT token validation via ForwardAuth
- **Authorization**: Route-based access control
- **Rate Limiting**: Multi-tier DDoS protection
- **Encryption**: TLS 1.2+ with strong cipher suites
- **Security Headers**: XSS, clickjacking, and MIME sniffing protection

### Security Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
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
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## JWT Authentication

### Overview

JWT (JSON Web Token) authentication is enforced via Traefik's ForwardAuth middleware. When a request arrives at a protected endpoint, Traefik forwards the request to the auth-service for validation.

### Token Validation Flow

```
1. Client sends request with Authorization: Bearer <token>
2. Traefik intercepts and forwards to auth-service:/api/auth/verify
3. Auth service validates:
   - Token signature (using shared JWT_SECRET)
   - Token expiration (exp claim)
   - Required claims (userId, email)
4. If valid: Returns 200 OK with X-User-* headers
   If invalid: Returns 401 Unauthorized
5. Traefik forwards request to upstream with user identity headers
```

### Token Claims Checked

| Claim | Description | Requirement |
|-------|-------------|-------------|
| `userId` | Numeric user identifier | Required |
| `email` | User's email address | Required |
| `exp` | Expiration timestamp | Required (verified automatically) |
| `iat` | Issued-at timestamp | Optional (for token age verification) |
| `role` | User role for authorization | Optional |

### Issuer Verification

Token issuer is implicitly verified through the shared `JWT_SECRET`. Only tokens signed with the correct secret are accepted. This ensures tokens can only be issued by the auth-service.

### Configuration

```yaml
# infrastructure/traefik/dynamic-config.yml
middlewares:
  jwt-auth:
    forwardAuth:
      address: "http://auth-service:3002/api/auth/verify"
      authResponseHeaders:
        - "X-User-Id"
        - "X-User-Email"
        - "X-User-Role"
      trustForwardHeader: true
```

### Security Recommendations

1. **Use strong JWT secrets**: Generate with `openssl rand -base64 32`
2. **Short token lifetime**: Default 1 hour limits exposure from stolen tokens
3. **Rotate secrets periodically**: Update JWT_SECRET in production regularly
4. **Use HTTPS**: Prevents token interception in transit

---

## Rate Limiting (DDoS Prevention)

### Overview

Multi-tier rate limiting prevents various attack vectors:

1. **Global rate limit**: Catches volumetric attacks
2. **Auth-specific limit**: Prevents brute force login attempts
3. **API rate limit**: Prevents application-layer abuse

### Rate Limit Tiers

| Tier | Average | Burst | Period | Use Case |
|------|---------|-------|--------|----------|
| `rate-limit` | 100 | 50 | 1 min | Standard API endpoints |
| `rate-limit-auth` | 20 | 10 | 1 min | Authentication endpoints |
| `rate-limit-strict` | 10 | 5 | 1 min | Sensitive operations |
| `rate-limit-global` | 500 | 100 | 1 min | Global DDoS protection |

### How Rate Limiting Works

```
Request arrives → Check source IP → Check rate limit bucket
                                         │
                                         ▼
                               ┌─────────────────┐
                               │ Tokens in bucket │
                               │   (burst + avg)  │
                               └─────────────────┘
                                         │
                        ┌────────────────┼────────────────┐
                        ▼                                 ▼
                  Tokens available                   No tokens
                        │                                 │
                        ▼                                 ▼
                  Process request                   429 Too Many
                  (consume token)                    Requests
```

### Configuration

```yaml
middlewares:
  rate-limit:
    rateLimit:
      average: 100        # Sustainable rate (requests/period)
      burst: 50           # Burst capacity
      period: 1m          # Time window
      sourceCriterion:
        ipStrategy:
          depth: 0        # Use direct client IP
```

### Attack Vectors Prevented

1. **Volumetric DDoS**: Global rate limit blocks high-volume attacks
2. **Brute Force**: Auth rate limit restricts login attempts
3. **API Abuse**: Standard rate limit prevents resource exhaustion
4. **Credential Stuffing**: Strict rate limit on password reset

---

## TLS Configuration

### Overview

TLS (Transport Layer Security) encrypts all traffic between clients and the API gateway, providing:

- **Confidentiality**: Prevents eavesdropping
- **Integrity**: Prevents tampering
- **Authentication**: Verifies server identity

### TLS Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| Minimum Version | TLS 1.2 | TLS 1.0/1.1 have known vulnerabilities |
| Maximum Version | TLS 1.3 | Latest protocol with improved security |
| Cipher Suites | AES-GCM, ChaCha20-Poly1305 | Strong, modern ciphers only |
| Key Exchange | ECDHE | Provides forward secrecy |

### Cipher Suite Priority

```yaml
cipherSuites:
  - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384      # Strong, widely compatible
  - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305       # Fast on mobile devices
  - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256      # Balance of speed/security
  - TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384    # For ECDSA certificates
  - TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305     # ECDSA + ChaCha20
```

### Certificate Management

#### Development (Self-Signed)

```bash
cd infrastructure/traefik/certs
./generate-certs.sh
```

#### Production (Let's Encrypt)

Uncomment the `certificatesResolvers` section in `traefik.yml`:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@your-domain.com
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web
```

### HSTS (HTTP Strict Transport Security)

HSTS forces browsers to always use HTTPS:

```yaml
headers:
  forceSTSHeader: true
  stsIncludeSubdomains: true
  stsPreload: true
  stsSeconds: 31536000  # 1 year
```

---

## Dynamic Service Discovery

### Overview

Traefik automatically discovers Podman/Docker containers and creates routing rules based on container labels. This enables:

- **Zero-downtime deployments**: New containers auto-registered
- **Service scaling**: Multiple replicas auto-discovered
- **Blue-green deployments**: Swap routing via labels

### Container Labels

Containers enable routing with these labels:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.myservice.rule=PathPrefix(`/api/myservice`)"
  - "traefik.http.services.myservice.loadbalancer.server.port=3000"
  - "traefik.http.routers.myservice.middlewares=jwt-auth@file"
```

### Podman Configuration

For Podman, set the socket path in `.env`:

```bash
# Rootless Podman
CONTAINER_SOCK=/run/user/1000/podman/podman.sock

# Rootful Podman
CONTAINER_SOCK=/run/podman/podman.sock
```

### Security Considerations

1. **Read-only socket**: Container socket mounted with `:ro`
2. **Explicit opt-in**: `exposedByDefault: false` requires labels
3. **Network isolation**: Only `eccs-network` containers are routable

---

## Routing Architecture

### Route Definitions

| Route | Path | Service | Middlewares | Auth |
|-------|------|---------|-------------|------|
| `auth-router` | `/api/auth/*` | auth-service | rate-limit-auth, security-headers | No |
| `email-router` | `/api/emails/*` | email-service | rate-limit, security-headers, jwt-auth | Yes |

### Middleware Order

Middlewares are applied left-to-right:

```
Request → rate-limit → security-headers → jwt-auth → retry → Service
```

**Rationale**: Rate limiting first rejects DDoS attacks before expensive JWT validation.

### Priority Rules

Lower priority number = higher precedence:

```yaml
email-router:
  priority: 10    # Matched before default routes
```

---

## Security Headers

### Headers Applied

| Header | Value | Protection |
|--------|-------|------------|
| X-Frame-Options | DENY | Clickjacking |
| X-Content-Type-Options | nosniff | MIME sniffing |
| X-XSS-Protection | 1; mode=block | XSS attacks |
| Strict-Transport-Security | max-age=31536000 | Downgrade attacks |
| Referrer-Policy | strict-origin-when-cross-origin | Referer leakage |
| Permissions-Policy | geolocation=(), microphone=() | Feature abuse |

### Configuration

```yaml
security-headers:
  headers:
    frameDeny: true
    browserXssFilter: true
    contentTypeNosniff: true
    forceSTSHeader: true
    stsSeconds: 31536000
```

---

## Operational Guidelines

### Monitoring

1. **Prometheus Metrics**: Available at `:8080/metrics`
2. **Access Logs**: JSON format for log aggregation
3. **Jaeger Traces**: Distributed tracing via Jaeger

### Health Checks

```bash
# Traefik health
curl http://localhost:8080/ping

# Dashboard
http://localhost:8080/dashboard/
```

### Troubleshooting

```bash
# Check Traefik logs
podman logs eccs-traefik

# Verify TLS certificate
openssl s_client -connect localhost:443 -servername api.localhost

# Test rate limiting
for i in {1..50}; do curl http://localhost/api/emails; done
```

### Production Checklist

- [ ] Replace self-signed certificates with CA-signed
- [ ] Enable HTTPS redirect (`sslRedirect: true`)
- [ ] Restrict dashboard access (remove `api.insecure=true`)
- [ ] Configure specific CORS origins
- [ ] Set strong JWT_SECRET in environment
- [ ] Review and adjust rate limits for traffic patterns
- [ ] Enable Let's Encrypt for automatic certificate renewal

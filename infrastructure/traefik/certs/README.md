# TLS Certificates for ECCS Traefik API Gateway

This directory contains TLS certificates for the Traefik API gateway.

## Security Overview

TLS (Transport Layer Security) encryption protects data in transit between clients and the API gateway:
- **Confidentiality**: Prevents eavesdropping on sensitive data (passwords, tokens, email content)
- **Integrity**: Prevents tampering with requests and responses
- **Authentication**: Verifies the server identity to clients

## Certificate Types

### Development: Self-Signed Certificates

For development and testing, use self-signed certificates generated with the script below.

**Important**: Self-signed certificates will show browser warnings because they're not trusted by certificate authorities.

### Production: CA-Signed Certificates

For production deployments, use certificates from a trusted Certificate Authority (CA):
- **Let's Encrypt**: Free, automated certificates (recommended)
- **Enterprise CA**: Internal PKI for corporate environments
- **Commercial CA**: DigiCert, Comodo, etc.

## Generating Self-Signed Certificates

Run the following command to generate development certificates:

```bash
# Generate a self-signed certificate valid for 365 days
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout eccs.key \
  -out eccs.crt \
  -subj "/C=US/ST=State/L=City/O=ECCS/OU=Development/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,DNS:api.localhost,DNS:traefik.localhost,IP:127.0.0.1"
```

### Certificate Details

- **Key Size**: 2048-bit RSA (4096-bit recommended for production)
- **Validity**: 365 days (shorter for production, e.g., 90 days)
- **Subject Alternative Names (SAN)**: Required for modern browsers

## File Permissions

Ensure private keys are properly secured:

```bash
# Restrict key file permissions
chmod 600 eccs.key
chmod 644 eccs.crt
```

## Traefik Configuration

The certificates are referenced in the dynamic configuration:

```yaml
# infrastructure/traefik/dynamic-config.yml
tls:
  certificates:
    - certFile: /etc/traefik/certs/eccs.crt
      keyFile: /etc/traefik/certs/eccs.key
```

## Let's Encrypt Integration

For production with automatic certificate management:

1. Uncomment the `certificatesResolvers` section in `traefik.yml`
2. Update the email address for certificate notifications
3. Ensure port 80 is accessible for HTTP-01 challenge
4. Or configure DNS-01 challenge for wildcard certificates

Example configuration:

```yaml
# infrastructure/traefik/traefik.yml
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@your-domain.com
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web
```

## Security Best Practices

1. **Never commit private keys** to version control
2. **Rotate certificates** regularly (before expiry)
3. **Use strong key sizes** (2048-bit minimum, 4096-bit recommended)
4. **Enable HSTS** to enforce HTTPS
5. **Disable weak protocols** (TLS 1.0, TLS 1.1)
6. **Use strong cipher suites** (AES-GCM, ChaCha20-Poly1305)

## Troubleshooting

### Certificate Verification

```bash
# View certificate details
openssl x509 -in eccs.crt -text -noout

# Verify certificate chain
openssl verify -CAfile ca.crt eccs.crt

# Check certificate expiration
openssl x509 -in eccs.crt -noout -dates
```

### Connection Testing

```bash
# Test TLS connection
openssl s_client -connect localhost:443 -servername localhost

# Check supported protocols and ciphers
nmap --script ssl-enum-ciphers -p 443 localhost
```

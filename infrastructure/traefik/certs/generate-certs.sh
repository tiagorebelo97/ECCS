#!/bin/bash
# ============================================================================
# ECCS TLS Certificate Generation Script
# ============================================================================
# Generates self-signed TLS certificates for development and testing.
#
# USAGE:
#   ./generate-certs.sh
#
# OUTPUT:
#   - eccs.key: Private key (RSA 2048-bit)
#   - eccs.crt: Self-signed certificate (valid 365 days)
#
# SECURITY:
#   - Self-signed certificates are for DEVELOPMENT ONLY
#   - Use Let's Encrypt or enterprise CA for production
#   - Private keys should never be committed to version control
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}"

# Certificate parameters
KEY_FILE="${CERT_DIR}/eccs.key"
CERT_FILE="${CERT_DIR}/eccs.crt"
DAYS_VALID=365
KEY_SIZE=2048

# Certificate subject
COUNTRY="US"
STATE="State"
LOCALITY="City"
ORGANIZATION="ECCS"
ORG_UNIT="Development"
COMMON_NAME="localhost"

# Subject Alternative Names (SAN) for modern browser compatibility
# Add all hostnames that will access the API gateway
SAN="DNS:localhost,DNS:*.localhost,DNS:api.localhost,DNS:traefik.localhost,DNS:frontend.localhost,DNS:grafana.localhost,DNS:kibana.localhost,DNS:jaeger.localhost,IP:127.0.0.1"

echo "=============================================="
echo "ECCS TLS Certificate Generator"
echo "=============================================="
echo ""
echo "Generating self-signed certificate..."
echo "  Key file:     ${KEY_FILE}"
echo "  Cert file:    ${CERT_FILE}"
echo "  Key size:     ${KEY_SIZE} bits"
echo "  Valid for:    ${DAYS_VALID} days"
echo "  Common Name:  ${COMMON_NAME}"
echo ""

# Generate private key and self-signed certificate
openssl req -x509 -nodes \
    -days ${DAYS_VALID} \
    -newkey rsa:${KEY_SIZE} \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -subj "/C=${COUNTRY}/ST=${STATE}/L=${LOCALITY}/O=${ORGANIZATION}/OU=${ORG_UNIT}/CN=${COMMON_NAME}" \
    -addext "subjectAltName=${SAN}" \
    2>/dev/null

# Set secure file permissions
chmod 600 "${KEY_FILE}"
chmod 644 "${CERT_FILE}"

echo "Certificate generated successfully!"
echo ""
echo "Certificate details:"
echo "--------------------------------------------"
openssl x509 -in "${CERT_FILE}" -noout -subject -dates -issuer
echo ""
echo "Subject Alternative Names:"
openssl x509 -in "${CERT_FILE}" -noout -text | grep -A1 "Subject Alternative Name" | tail -1 | sed 's/^[[:space:]]*/  /'
echo ""
echo "=============================================="
echo "IMPORTANT SECURITY NOTES:"
echo "=============================================="
echo "1. These certificates are for DEVELOPMENT ONLY"
echo "2. Browsers will show security warnings"
echo "3. Do NOT use in production - use Let's Encrypt"
echo "4. Never commit eccs.key to version control"
echo "=============================================="

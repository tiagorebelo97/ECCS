# mkcert development TLS for Traefik (ECCS)

This document explains how to generate locally-trusted TLS certificates using `mkcert`
and how to mount them into the Traefik container for local HTTPS on `https://localhost:8443`.

## 1) Install mkcert

macOS (Homebrew):

```bash
brew install mkcert nss
mkcert -install
```

Ubuntu/Debian (example):

```bash
# install mkcert (see https://mkcert.dev)
# e.g. using snap or deb package depending on distro
sudo apt install libnss3-tools
wget -O mkcert https://dl.filippo.io/mkcert/latest?for=linux/amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/
mkcert -install
```

## 2) Generate certs for localhost

```bash
# run inside repo or output to infrastructure/traefik/certs
mkdir -p infrastructure/traefik/certs
cd infrastructure/traefik/certs
mkcert localhost 127.0.0.1 ::1
# this will create files like: localhost+2.pem and localhost+2-key.pem
# rename for clarity:
mv localhost+2.pem localhost.pem
mv localhost+2-key.pem localhost-key.pem
```

## 3) Mount certs into Traefik container

If you run Traefik via docker-compose, mount the certs directory and the dynamic tls file:

```yaml
# example override (infrastructure/traefik/docker-compose.mkcert.yml)
services:
  traefik:
    volumes:
      - ./dynamic/tls-dev.yml:/etc/traefik/dynamic/tls-dev.yml:ro
      - ./certs:/certs:ro
```

After mounting, Traefik will pick up the certificate from `/certs/localhost.pem` and `/certs/localhost-key.pem`.

## 4) Verify

- Start Traefik (with the override mount) and access `https://localhost:8443` in the browser.
- The cert should be trusted (no warnings) because mkcert installed the developer CA on your machine.
- Use `curl -I https://localhost:8443` to verify headers.

## Notes
- Do NOT commit the generated certs to git. The repository contains `.gitignore` entry for `infrastructure/traefik/certs/*`.
- This flow is for local development only. For production, use ACME/Let's Encrypt (Traefik supports it via certificatesResolvers).

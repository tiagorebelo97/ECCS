# mkcert — TLS de desenvolvimento para Traefik (ECCS)

Este documento explica como gerar certificados locais confiáveis com `mkcert` e montá-los no container Traefik para suportar HTTPS em `https://localhost:8443` durante o desenvolvimento.

## 1) Instalar mkcert

macOS (Homebrew):

```bash
brew install mkcert nss
mkcert -install
```

Ubuntu/Debian (exemplo):

```bash
sudo apt install libnss3-tools
# Instalar mkcert conforme a tua distro (ver https://mkcert.dev)
# Exemplo rápido (pode variar):
wget -O mkcert https://dl.filippo.io/mkcert/latest?for=linux/amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/
mkcert -install
```

## 2) Gerar certificados para localhost

```bash
mkdir -p infrastructure/traefik/certs
cd infrastructure/traefik/certs
mkcert localhost 127.0.0.1 ::1
# Os ficheiros gerados podem ter nomes como: localhost+2.pem e localhost+2-key.pem
# Recomendo renomear:
mv localhost+2.pem localhost.pem
mv localhost+2-key.pem localhost-key.pem
```

## 3) Exemplo: montar os certificados no Traefik (docker-compose override)
Cria um ficheiro `infrastructure/traefik/docker-compose.mkcert.yml` com o snippet abaixo e usa-o em conjunto com o compose principal (ex.: `docker compose -f docker-compose.yml -f docker-compose.mkcert.yml up`).

```yaml
version: '3.8'
services:
  traefik:
    volumes:
      - ./dynamic/tls-dev.yml:/etc/traefik/dynamic/tls-dev.yml:ro
      - ./certs:/certs:ro
```

O `tls-dev.yml` faz com que o Traefik leia o certificado montado em `/certs/localhost.pem` e a chave em `/certs/localhost-key.pem`.

## 4) Verificar

- Inicia o Traefik com o override e acede: `https://localhost:8443`
- O certificado deverá ser confiável (sem avisos) porque o CA do mkcert foi instalado no teu sistema.
- Teste rápido: `curl -I https://localhost:8443`

## Notas

- NÃO comites os certificados gerados. Este repositório ignora `infrastructure/traefik/certs/*`.
- Esta solução é apenas para desenvolvimento local. Em produção usa ACME/Let's Encrypt.

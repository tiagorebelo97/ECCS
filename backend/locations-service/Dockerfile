# ============================================================================
# ECCS Locations Service Dockerfile - Node.js Backend Microservice
# ============================================================================
# This Dockerfile creates a secure, optimized Node.js backend service for
# handling location operations in the ECCS platform.
#
# SERVICE RESPONSIBILITIES:
#   - Save map locations with names and addresses
#   - Store locations in PostgreSQL
#   - Index locations in Elasticsearch for map visualization
#   - Reverse geocoding integration
# ============================================================================

FROM node:18-alpine

LABEL org.opencontainers.image.title="ECCS Locations Service"
LABEL org.opencontainers.image.description="Location management microservice for ECCS platform"
LABEL org.opencontainers.image.version="1.0.0"
LABEL maintainer="ECCS DevOps Team"

RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
        tini \
        curl && \
    rm -rf /var/cache/apk/*

WORKDIR /app

RUN chown -R node:node /app

COPY --chown=node:node package*.json ./

RUN npm ci --omit=dev && \
    npm cache clean --force

COPY --chown=node:node . .

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

EXPOSE 3003

USER node

ENV NODE_ENV=production

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["npm", "start"]

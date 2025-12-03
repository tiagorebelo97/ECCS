// Service definitions for the ECCS documentation website
// Data extracted from podman-compose.yml configuration

export const services = {
  // Frontend Services
  frontend: {
    name: 'Frontend',
    description: 'React-based web interface for the ECCS platform. Serves static files via Nginx and proxies API requests to Traefik.',
    port: 3000,
    technology: 'React + Nginx',
    icon: '⚛️',
    color: '#61DAFB',
    category: 'Frontend',
    type: 'frontend',
    features: ['React SPA', 'Nginx Proxy', 'Security Headers', 'Production Build'],
    endpoints: [],
    dependencies: ['traefik'],
    details: {
      container: 'eccs-frontend',
      image: 'custom (Dockerfile)',
      network: 'eccs-network'
    },
    metrics: false
  },

  docsWebsite: {
    name: 'Documentation Website',
    description: 'Documentation website for the ECCS platform. Serves static documentation files via Nginx.',
    port: 3100,
    technology: 'Vite + React + Nginx',
    icon: '📚',
    color: '#9F7AEA',
    category: 'Frontend',
    type: 'frontend',
    features: ['Static Docs', 'Nginx Server', 'Health Check'],
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check endpoint' }
    ],
    dependencies: [],
    details: {
      container: 'eccs-docs-website',
      image: 'custom (Dockerfile)',
      network: 'eccs-network'
    },
    metrics: false
  },

  // Backend Services
  emailService: {
    name: 'Email Service',
    description: 'Handles email composition, validation, and queuing. Publishes events to Kafka for async processing.',
    port: 3001,
    technology: 'Node.js + Express',
    icon: '📧',
    color: '#68D391',
    category: 'Backend',
    type: 'backend',
    features: ['Email Queuing', 'Kafka Events', 'JWT Auth', 'Distributed Tracing'],
    endpoints: [
      { method: 'POST', path: '/api/emails', description: 'Create and queue new email' },
      { method: 'GET', path: '/api/emails', description: "List user's emails" },
      { method: 'GET', path: '/api/emails/:id', description: 'Get email details' },
      { method: 'GET', path: '/health', description: 'Health check endpoint' }
    ],
    dependencies: ['postgres', 'kafka', 'mongodb'],
    details: {
      container: 'eccs-email-service',
      replicas: 2,
      network: 'eccs-network'
    },
    metrics: true
  },

  authService: {
    name: 'Auth Service',
    description: 'Handles user registration, login, and JWT token management. Provides token verification for Traefik forward auth.',
    port: 3002,
    technology: 'Node.js + Express',
    icon: '🔐',
    color: '#F6AD55',
    category: 'Backend',
    type: 'backend',
    features: ['User Registration', 'JWT Tokens', 'Password Hashing', 'Rate Limiting'],
    endpoints: [
      { method: 'POST', path: '/api/auth/register', description: 'User registration' },
      { method: 'POST', path: '/api/auth/login', description: 'User login (returns JWT)' },
      { method: 'POST', path: '/api/auth/refresh', description: 'Refresh JWT token' },
      { method: 'GET', path: '/api/auth/verify', description: 'Verify token (for Traefik)' },
      { method: 'POST', path: '/api/auth/logout', description: 'Invalidate refresh token' },
      { method: 'GET', path: '/health', description: 'Health check endpoint' }
    ],
    dependencies: ['postgres'],
    details: {
      container: 'eccs-auth-service',
      network: 'eccs-network'
    },
    metrics: true
  },

  notificationService: {
    name: 'Notification Service',
    description: 'Consumes email events from Kafka and handles actual email delivery. Implements retry logic with exponential backoff.',
    port: 3004,
    technology: 'Node.js + Kafka',
    icon: '🔔',
    color: '#FC8181',
    category: 'Backend',
    type: 'backend',
    features: ['SMTP Delivery', 'Retry Logic', 'Dead Letter Queue', 'Audit Logging'],
    endpoints: [],
    dependencies: ['kafka', 'mongodb', 'postfix', 'postgres'],
    details: {
      container: 'eccs-notification-service',
      replicas: 2,
      kafkaTopics: ['email_requests', 'email_requests_retry', 'email_dlq'],
      network: 'eccs-network'
    },
    metrics: true
  },

  locationsService: {
    name: 'Locations Service',
    description: 'Handles map location management with reverse geocoding. Stores locations in PostgreSQL and indexes them in Elasticsearch for map visualization.',
    port: 3003,
    technology: 'Node.js + Express',
    icon: '📍',
    color: '#38A169',
    category: 'Backend',
    type: 'backend',
    features: ['Reverse Geocoding', 'Geo-Point Indexing', 'JWT Auth', 'Elasticsearch Maps'],
    endpoints: [
      { method: 'GET', path: '/api/locations', description: "List user's saved locations" },
      { method: 'POST', path: '/api/locations', description: 'Save a new location' },
      { method: 'GET', path: '/api/locations/:id', description: 'Get specific location' },
      { method: 'PUT', path: '/api/locations/:id', description: 'Update a location' },
      { method: 'DELETE', path: '/api/locations/:id', description: 'Delete a location' },
      { method: 'GET', path: '/api/locations/reverse-geocode/:lat/:lon', description: 'Get address from coordinates' },
      { method: 'GET', path: '/health', description: 'Health check endpoint' }
    ],
    dependencies: ['postgres', 'elasticsearch'],
    details: {
      container: 'eccs-locations-service',
      network: 'eccs-network'
    },
    metrics: true
  },

  // API Gateway
  traefik: {
    name: 'Traefik',
    description: 'Central entry point for all HTTP traffic. Provides routing, load balancing, JWT auth, rate limiting, and TLS termination.',
    port: '8800/8443/8080',
    technology: 'Traefik v3',
    icon: '🚀',
    color: '#9F7AEA',
    category: 'Gateway',
    type: 'infrastructure',
    features: ['Dynamic Routing', 'JWT Auth', 'Rate Limiting', 'TLS Termination', 'Distributed Tracing'],
    endpoints: [
      { method: 'GET', path: '/ping', description: 'Health check endpoint' },
      { method: 'GET', path: '/api/...', description: 'Routes to backend services' }
    ],
    dependencies: ['email-service', 'auth-service'],
    details: {
      container: 'eccs-traefik',
      ports: { http: 8800, https: 8443, dashboard: 8080 },
      network: 'eccs-network'
    },
    metrics: true
  },

  // Databases
  postgres: {
    name: 'PostgreSQL',
    description: 'Primary relational database storing structured data for users and emails. Uses Alpine image for smaller footprint.',
    port: 5432,
    technology: 'PostgreSQL 15',
    icon: '🐘',
    color: '#4299E1',
    category: 'Database',
    type: 'database',
    features: ['User Data', 'Email Records', 'ACID Compliance', 'Health Checks'],
    endpoints: [],
    dependencies: [],
    details: {
      container: 'eccs-postgres',
      databases: ['eccs_email', 'eccs_auth'],
      volume: 'postgres_data',
      network: 'eccs-network'
    },
    metrics: false
  },

  mongodb: {
    name: 'MongoDB',
    description: 'Document database for storing unstructured data: logs, audit trails, and metrics. Optimized for high write throughput.',
    port: 27017,
    technology: 'MongoDB 6',
    icon: '🍃',
    color: '#68D391',
    category: 'Database',
    type: 'database',
    features: ['Email Logs', 'Audit Events', 'TTL Indexes', 'Schema Validation'],
    endpoints: [],
    dependencies: [],
    details: {
      container: 'eccs-mongodb',
      collections: ['email_logs', 'application_logs', 'audit_events', 'metrics'],
      volumes: ['mongodb_data', 'mongodb_config'],
      network: 'eccs-network'
    },
    metrics: false
  },

  // Message Streaming
  zookeeper: {
    name: 'Zookeeper',
    description: 'Provides distributed coordination for Kafka cluster. Required for Kafka broker operation.',
    port: 2181,
    technology: 'Confluent Zookeeper 7.4',
    icon: '🦓',
    color: '#D69E2E',
    category: 'Messaging',
    type: 'infrastructure',
    features: ['Broker Registration', 'Leader Election', 'Config Management'],
    endpoints: [],
    dependencies: [],
    details: {
      container: 'eccs-zookeeper',
      volumes: ['zookeeper_data', 'zookeeper_log'],
      network: 'eccs-network'
    },
    metrics: false
  },

  kafka: {
    name: 'Apache Kafka',
    description: 'Provides reliable, scalable message streaming. Used for asynchronous communication between services.',
    port: 9092,
    technology: 'Confluent Kafka 7.4',
    icon: '📨',
    color: '#E53E3E',
    category: 'Messaging',
    type: 'infrastructure',
    features: ['Message Streaming', 'Topic Partitioning', 'Consumer Groups', '7-Day Retention'],
    endpoints: [],
    dependencies: ['zookeeper'],
    details: {
      container: 'eccs-kafka',
      topics: ['email_requests', 'email_requests_retry', 'email_dlq'],
      volume: 'kafka_data',
      network: 'eccs-network'
    },
    metrics: true
  },

  // Observability - ELK Stack
  elasticsearch: {
    name: 'Elasticsearch',
    description: 'Stores and indexes log data from all services. Provides full-text search, geo-point queries for location visualization, and aggregation capabilities.',
    port: 9200,
    technology: 'Elasticsearch 8.11',
    icon: '🔍',
    color: '#FBD38D',
    category: 'Observability',
    type: 'observability',
    features: ['Log Indexing', 'Full-Text Search', 'Geo-Point Queries', 'Aggregations', 'ILM Policies'],
    endpoints: [
      { method: 'GET', path: '/_cluster/health', description: 'Cluster health status' },
      { method: 'GET', path: '/_search', description: 'Search logs' }
    ],
    dependencies: [],
    details: {
      container: 'eccs-elasticsearch',
      indices: ['eccs-logs-*', 'eccs-email-logs-*', 'eccs-app-logs-*', 'eccs-locations'],
      volume: 'elasticsearch_data',
      network: 'eccs-network'
    },
    metrics: true
  },

  logstash: {
    name: 'Logstash',
    description: 'Receives, transforms, and routes logs to Elasticsearch. Central aggregation point for all application logs.',
    port: '5000/5044',
    technology: 'Logstash 8.11',
    icon: '📝',
    color: '#F687B3',
    category: 'Observability',
    type: 'observability',
    features: ['Log Aggregation', 'JSON Parsing', 'GeoIP Enrichment', 'Service Tagging'],
    endpoints: [],
    dependencies: ['elasticsearch'],
    details: {
      container: 'eccs-logstash',
      pipelines: ['eccs-main'],
      disabledPipelines: ['eccs-mongodb'],
      network: 'eccs-network'
    },
    metrics: true
  },

  kibana: {
    name: 'Kibana',
    description: 'Web interface for exploring and visualizing Elasticsearch data. Pre-configured with ECCS dashboards including map visualization for saved locations.',
    port: 5601,
    technology: 'Kibana 8.11',
    icon: '📊',
    color: '#E53E3E',
    category: 'Observability',
    type: 'observability',
    features: ['Log Search', 'Dashboards', 'Visualizations', 'Alerting', 'Kibana Maps'],
    endpoints: [
      { method: 'GET', path: '/api/status', description: 'Kibana status' }
    ],
    dependencies: ['elasticsearch'],
    details: {
      container: 'eccs-kibana',
      dashboards: ['[ECCS] Email Processing Dashboard', '[ECCS] Saved Locations Map Dashboard'],
      network: 'eccs-network'
    },
    metrics: false
  },

  // Metrics and Tracing
  grafana: {
    name: 'Grafana',
    description: 'Unified dashboard for metrics, logs, and traces. Pre-configured with Prometheus, Elasticsearch, and Jaeger datasources.',
    port: 3030,
    technology: 'Grafana 10.2',
    icon: '📈',
    color: '#F6AD55',
    category: 'Observability',
    type: 'observability',
    features: ['Metrics Dashboards', 'Multi-Datasource', 'Alerting', 'Variables'],
    endpoints: [
      { method: 'GET', path: '/api/health', description: 'Health check' }
    ],
    dependencies: ['prometheus'],
    details: {
      container: 'eccs-grafana',
      volume: 'grafana_data',
      network: 'eccs-network'
    },
    metrics: false
  },

  prometheus: {
    name: 'Prometheus',
    description: 'Scrapes and stores time-series metrics from all services. Provides PromQL for querying and alerting.',
    port: 9091,
    technology: 'Prometheus 2.47',
    icon: '🔥',
    color: '#E53E3E',
    category: 'Observability',
    type: 'observability',
    features: ['Metrics Scraping', 'PromQL', 'Alert Rules', '15-Day Retention'],
    endpoints: [
      { method: 'GET', path: '/-/healthy', description: 'Health check' },
      { method: 'GET', path: '/api/v1/query', description: 'Query metrics' }
    ],
    dependencies: ['kafka-exporter'],
    details: {
      container: 'eccs-prometheus',
      volume: 'prometheus_data',
      network: 'eccs-network'
    },
    metrics: true
  },

  jaeger: {
    name: 'Jaeger',
    description: 'Collects and visualizes distributed traces across services. Helps debug request flows and identify bottlenecks.',
    port: 16686,
    technology: 'Jaeger 1.51',
    icon: '🔬',
    color: '#4FD1C5',
    category: 'Observability',
    type: 'observability',
    features: ['Distributed Tracing', 'Service Maps', 'Latency Analysis', 'OTLP Support'],
    endpoints: [],
    dependencies: [],
    details: {
      container: 'eccs-jaeger',
      ports: { ui: 16686, collector: 14268, otlpGrpc: 4317, otlpHttp: 4318 },
      network: 'eccs-network'
    },
    metrics: false
  },

  kafkaExporter: {
    name: 'Kafka Exporter',
    description: 'Exposes Kafka cluster metrics in Prometheus format. Essential for monitoring consumer lag and topic throughput.',
    port: 9308,
    technology: 'Kafka Exporter',
    icon: '📤',
    color: '#9F7AEA',
    category: 'Observability',
    type: 'observability',
    features: ['Consumer Lag', 'Topic Metrics', 'Broker Health', 'Prometheus Format'],
    endpoints: [
      { method: 'GET', path: '/metrics', description: 'Prometheus metrics' }
    ],
    dependencies: ['kafka'],
    details: {
      container: 'eccs-kafka-exporter',
      network: 'eccs-network'
    },
    metrics: true
  },

  alertmanager: {
    name: 'Alertmanager',
    description: 'Handles alert deduplication, grouping, routing, and notification. Receives alerts from Prometheus.',
    port: 9093,
    technology: 'Alertmanager 0.26',
    icon: '🚨',
    color: '#FC8181',
    category: 'Observability',
    type: 'observability',
    features: ['Alert Routing', 'Grouping', 'Silencing', 'Multi-Channel Notifications'],
    endpoints: [
      { method: 'GET', path: '/-/healthy', description: 'Health check' }
    ],
    dependencies: [],
    details: {
      container: 'eccs-alertmanager',
      volume: 'alertmanager_data',
      network: 'eccs-network'
    },
    metrics: false
  },

  // Email Delivery
  postfix: {
    name: 'Postfix',
    description: 'Production-ready Mail Transfer Agent (MTA) that delivers emails to recipients. Supports TLS and relay configuration.',
    port: '2525/1587',
    technology: 'Postfix (boky/postfix)',
    icon: '📮',
    color: '#68D391',
    category: 'Email',
    type: 'infrastructure',
    features: ['SMTP Server', 'TLS Encryption', 'Relay Support', 'Queue Management'],
    endpoints: [],
    dependencies: [],
    details: {
      container: 'eccs-postfix',
      ports: { smtp: 2525, submission: 1587 },
      volume: 'postfix_spool',
      network: 'eccs-network'
    },
    metrics: false
  }
}

// Flow examples for the Flows page
export const flowExamples = [
  {
    id: 'user-registration',
    title: 'User Registration Flow',
    description: 'Complete user registration process with email verification',
    steps: [
      { service: 'frontend', icon: '👤', action: 'User fills registration form' },
      { service: 'traefik', icon: '🚀', action: 'Request routed to auth service' },
      { service: 'authService', icon: '🔐', action: 'Validate input and hash password' },
      { service: 'postgres', icon: '🐘', action: 'Store user in database' },
      { service: 'kafka', icon: '📨', action: 'Publish verification email event' },
      { service: 'notificationService', icon: '🔔', action: 'Consume event and prepare email' },
      { service: 'postfix', icon: '📮', action: 'Send verification email via SMTP' },
      { service: 'mongodb', icon: '🍃', action: 'Log email delivery status' }
    ]
  },
  {
    id: 'send-email',
    title: 'Send Email Flow',
    description: 'Complete email sending workflow with retry handling',
    steps: [
      { service: 'frontend', icon: '✉️', action: 'User composes email' },
      { service: 'traefik', icon: '🚀', action: 'Validate JWT and route request' },
      { service: 'emailService', icon: '📧', action: 'Validate and queue email' },
      { service: 'postgres', icon: '🐘', action: 'Store email record' },
      { service: 'kafka', icon: '📨', action: 'Publish to email_requests topic' },
      { service: 'notificationService', icon: '🔔', action: 'Consume and process email' },
      { service: 'postfix', icon: '📮', action: 'Deliver email via SMTP' },
      { service: 'mongodb', icon: '🍃', action: 'Log delivery result' },
      { service: 'elasticsearch', icon: '🔍', action: 'Index logs for search' }
    ]
  },
  {
    id: 'email-retry',
    title: 'Email Retry Flow',
    description: 'Automatic retry mechanism for failed email delivery',
    steps: [
      { service: 'notificationService', icon: '🔔', action: 'Email delivery fails' },
      { service: 'kafka', icon: '📨', action: 'Publish to email_requests_retry topic' },
      { service: 'mongodb', icon: '🍃', action: 'Log retry attempt' },
      { service: 'notificationService', icon: '🔔', action: 'Consume retry message (with backoff)' },
      { service: 'postfix', icon: '📮', action: 'Retry email delivery' },
      { service: 'kafka', icon: '📨', action: 'On final failure, send to DLQ' },
      { service: 'alertmanager', icon: '🚨', action: 'Trigger DLQ alert' }
    ]
  },
  {
    id: 'user-login',
    title: 'User Login Flow',
    description: 'Authentication flow with JWT token generation',
    steps: [
      { service: 'frontend', icon: '👤', action: 'User enters credentials' },
      { service: 'traefik', icon: '🚀', action: 'Route to auth service (no JWT required)' },
      { service: 'authService', icon: '🔐', action: 'Validate credentials' },
      { service: 'postgres', icon: '🐘', action: 'Query user data' },
      { service: 'authService', icon: '🔐', action: 'Generate JWT access token' },
      { service: 'mongodb', icon: '🍃', action: 'Log successful login' },
      { service: 'frontend', icon: '⚛️', action: 'Store token and redirect' }
    ]
  },
  {
    id: 'observability',
    title: 'Observability Pipeline',
    description: 'How logs and metrics flow through the monitoring stack',
    steps: [
      { service: 'emailService', icon: '📧', action: 'Generate application logs' },
      { service: 'logstash', icon: '📝', action: 'Receive and parse logs' },
      { service: 'elasticsearch', icon: '🔍', action: 'Index and store logs' },
      { service: 'kibana', icon: '📊', action: 'Visualize in dashboards' },
      { service: 'prometheus', icon: '🔥', action: 'Scrape service metrics' },
      { service: 'grafana', icon: '📈', action: 'Display metrics dashboards' },
      { service: 'alertmanager', icon: '🚨', action: 'Process alert rules' }
    ]
  },
  {
    id: 'distributed-trace',
    title: 'Distributed Tracing Flow',
    description: 'Request tracing across multiple services',
    steps: [
      { service: 'traefik', icon: '🚀', action: 'Generate trace ID, forward to Jaeger' },
      { service: 'authService', icon: '🔐', action: 'Add span for auth verification' },
      { service: 'emailService', icon: '📧', action: 'Add span for email processing' },
      { service: 'kafka', icon: '📨', action: 'Propagate trace context in headers' },
      { service: 'notificationService', icon: '🔔', action: 'Add span for notification' },
      { service: 'jaeger', icon: '🔬', action: 'Collect and visualize traces' }
    ]
  },
  {
    id: 'save-location',
    title: 'Save Location Flow',
    description: 'Complete flow for saving a map location with geocoding',
    steps: [
      { service: 'frontend', icon: '🗺️', action: 'User clicks on map to select location' },
      { service: 'traefik', icon: '🚀', action: 'Validate JWT and route request' },
      { service: 'locationsService', icon: '📍', action: 'Receive coordinates and validate' },
      { service: 'locationsService', icon: '📍', action: 'Reverse geocode via Nominatim API' },
      { service: 'postgres', icon: '🐘', action: 'Store location with address' },
      { service: 'elasticsearch', icon: '🔍', action: 'Index location as geo_point' },
      { service: 'kibana', icon: '📊', action: 'Visualize on Kibana Maps' },
      { service: 'logstash', icon: '📝', action: 'Log location save event' }
    ]
  }
]

// Port summary for quick reference (used in HomePage)
export const portSummary = [
  { service: 'Frontend', port: '3000', protocol: 'HTTP', access: 'Public' },
  { service: 'Docs Website', port: '3100', protocol: 'HTTP', access: 'Public' },
  { service: 'Traefik HTTP', port: '8800', protocol: 'HTTP', access: 'Public' },
  { service: 'Traefik HTTPS', port: '8443', protocol: 'HTTPS', access: 'Public' },
  { service: 'Traefik Dashboard', port: '8080', protocol: 'HTTP', access: 'Internal' },
  { service: 'Auth Service', port: '3002', protocol: 'HTTP', access: 'Internal' },
  { service: 'Email Service', port: '3001', protocol: 'HTTP', access: 'Internal' },
  { service: 'Locations Service', port: '3003', protocol: 'HTTP', access: 'Internal' },
  { service: 'Notification Service', port: '3004', protocol: 'HTTP', access: 'Internal' },
  { service: 'PostgreSQL', port: '5432', protocol: 'TCP', access: 'Internal' },
  { service: 'MongoDB', port: '27017', protocol: 'TCP', access: 'Internal' },
  { service: 'Kafka', port: '9092', protocol: 'TCP', access: 'Internal' },
  { service: 'Zookeeper', port: '2181', protocol: 'TCP', access: 'Internal' },
  { service: 'Elasticsearch', port: '9200', protocol: 'HTTP', access: 'Internal' },
  { service: 'Kibana', port: '5601', protocol: 'HTTP', access: 'Public' },
  { service: 'Grafana', port: '3030', protocol: 'HTTP', access: 'Public' },
  { service: 'Prometheus', port: '9091', protocol: 'HTTP', access: 'Internal' },
  { service: 'Jaeger UI', port: '16686', protocol: 'HTTP', access: 'Public' },
  { service: 'Alertmanager', port: '9093', protocol: 'HTTP', access: 'Internal' },
  { service: 'Postfix SMTP', port: '2525', protocol: 'SMTP', access: 'Internal' },
  { service: 'Logstash TCP', port: '5000', protocol: 'TCP', access: 'Internal' },
  { service: 'Logstash Beats', port: '5044', protocol: 'TCP', access: 'Internal' }
]

// Architecture layers for the architecture page
export const architectureLayers = [
  {
    name: 'Frontend Layer',
    description: 'User-facing applications including the React frontend and documentation website.',
    color: '#61DAFB',
    services: ['frontend', 'docsWebsite']
  },
  {
    name: 'API Gateway',
    description: 'Central entry point for all HTTP traffic with routing, authentication, and rate limiting.',
    color: '#9F7AEA',
    services: ['traefik']
  },
  {
    name: 'Application Layer',
    description: 'Backend microservices handling business logic for authentication, email processing, notifications, and location management.',
    color: '#68D391',
    services: ['authService', 'emailService', 'notificationService', 'locationsService']
  },
  {
    name: 'Data Layer',
    description: 'Persistent storage and message streaming infrastructure.',
    color: '#4299E1',
    services: ['postgres', 'mongodb', 'kafka', 'zookeeper']
  },
  {
    name: 'Observability Layer',
    description: 'Logging, metrics, tracing, and alerting infrastructure for system monitoring.',
    color: '#F687B3',
    services: ['elasticsearch', 'logstash', 'kibana', 'prometheus', 'grafana', 'jaeger', 'kafkaExporter', 'alertmanager']
  },
  {
    name: 'Email Delivery',
    description: 'SMTP infrastructure for actual email delivery.',
    color: '#68D391',
    services: ['postfix']
  }
]

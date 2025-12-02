import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiZap, FiDatabase, FiServer, FiShield, FiActivity, FiBox, FiLayers, FiArrowRight } from 'react-icons/fi'
import { services, architectureLayers } from '../data/services'

// Animated Architecture Diagram Component
function AnimatedArchitecture() {
  const [hoveredLayer, setHoveredLayer] = useState(null)
  const [animationState, setAnimationState] = useState('idle')

  // Layer definitions for the SVG diagram
  const layers = [
    { id: 'frontend', y: 40, label: 'Frontend Layer', color: '#61DAFB', services: ['React Frontend'] },
    { id: 'gateway', y: 110, label: 'API Gateway', color: '#9F7AEA', services: ['Traefik'] },
    { id: 'services', y: 180, label: 'Application Layer', color: '#68D391', services: ['Auth', 'Email', 'Notification'] },
    { id: 'data', y: 260, label: 'Data Layer', color: '#4299E1', services: ['PostgreSQL', 'MongoDB', 'Kafka'] },
    { id: 'observability', y: 340, label: 'Observability', color: '#F687B3', services: ['ELK', 'Prometheus', 'Grafana', 'Jaeger'] }
  ]

  return (
    <div className="card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-2xl)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ margin: 0 }}>Interactive Architecture Diagram</h3>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button 
            className={`btn ${animationState === 'request' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAnimationState(animationState === 'request' ? 'idle' : 'request')}
            style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
          >
            {animationState === 'request' ? '⏸ Stop' : '▶ Animate Request'}
          </button>
        </div>
      </div>

      <svg viewBox="0 0 800 420" style={{ width: '100%', height: 'auto', minHeight: 400 }}>
        <defs>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1"/>
          </marker>
        </defs>

        {/* Background grid */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="0.5"/>
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Layers */}
        {layers.map((layer, index) => (
          <g key={layer.id}>
            {/* Layer background */}
            <motion.rect
              x={40}
              y={layer.y}
              width={720}
              height={60}
              rx={8}
              fill={hoveredLayer === layer.id ? `${layer.color}30` : `${layer.color}15`}
              stroke={layer.color}
              strokeWidth={hoveredLayer === layer.id ? 2 : 1}
              strokeOpacity={0.5}
              onMouseEnter={() => setHoveredLayer(layer.id)}
              onMouseLeave={() => setHoveredLayer(null)}
              style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            />

            {/* Layer label */}
            <text x={60} y={layer.y + 25} fill={layer.color} fontSize={12} fontWeight={600}>
              {layer.label}
            </text>

            {/* Services */}
            {layer.services.map((service, sIndex) => {
              const serviceX = 180 + sIndex * 160
              return (
                <motion.g 
                  key={service}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 + sIndex * 0.05 }}
                >
                  <rect
                    x={serviceX}
                    y={layer.y + 15}
                    width={140}
                    height={30}
                    rx={6}
                    fill={`${layer.color}40`}
                    stroke={layer.color}
                    strokeWidth={1}
                  />
                  <text 
                    x={serviceX + 70} 
                    y={layer.y + 35} 
                    fill="white" 
                    fontSize={11} 
                    textAnchor="middle"
                    fontWeight={500}
                  >
                    {service}
                  </text>
                </motion.g>
              )
            })}
          </g>
        ))}

        {/* Connection lines */}
        <g opacity={0.6}>
          {/* Frontend to Gateway */}
          <motion.path
            d="M 400 100 L 400 110"
            stroke="url(#flowGradient)"
            strokeWidth={2}
            fill="none"
            markerEnd="url(#arrowhead)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          />
          
          {/* Gateway to Services */}
          <motion.path
            d="M 320 170 L 250 180"
            stroke="url(#flowGradient)"
            strokeWidth={2}
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          />
          <motion.path
            d="M 400 170 L 400 180"
            stroke="url(#flowGradient)"
            strokeWidth={2}
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.9 }}
          />
          <motion.path
            d="M 480 170 L 550 180"
            stroke="url(#flowGradient)"
            strokeWidth={2}
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
          />

          {/* Services to Data */}
          <motion.path
            d="M 250 240 L 250 260"
            stroke="url(#flowGradient)"
            strokeWidth={2}
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          />
          <motion.path
            d="M 400 240 L 400 260"
            stroke="url(#flowGradient)"
            strokeWidth={2}
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 1.3 }}
          />
          <motion.path
            d="M 550 240 L 550 260"
            stroke="url(#flowGradient)"
            strokeWidth={2}
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 1.4 }}
          />
        </g>

        {/* Animated request flow */}
        <AnimatePresence>
          {animationState === 'request' && (
            <motion.circle
              cx={400}
              cy={70}
              r={8}
              fill="#6366f1"
              filter="url(#glow)"
              initial={{ cy: 70 }}
              animate={{ 
                cy: [70, 140, 210, 290, 370],
                cx: [400, 400, 250, 400, 550]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                repeatDelay: 1,
                ease: "easeInOut"
              }}
            />
          )}
        </AnimatePresence>
      </svg>

      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: 'var(--space-md)' }}>
        💡 Hover over layers to highlight. Click "Animate Request" to see data flow through the system.
      </p>
    </div>
  )
}

// Layer Detail Card
function LayerCard({ layer, isExpanded, onToggle }) {
  const layerServices = layer.services.map(key => services[key]).filter(Boolean)

  return (
    <motion.div 
      className="card"
      style={{ 
        marginBottom: 'var(--space-md)',
        borderLeft: `4px solid ${layer.color}`,
        overflow: 'hidden'
      }}
      layout
    >
      <div 
        onClick={onToggle}
        style={{ 
          padding: 'var(--space-lg)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <h4 style={{ margin: 0, marginBottom: 'var(--space-xs)' }}>{layer.name}</h4>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            {layer.description}
          </p>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <FiArrowRight size={20} />
        </motion.div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ 
              padding: 'var(--space-lg)', 
              paddingTop: 0,
              borderTop: '1px solid var(--color-border)'
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 'var(--space-md)',
                marginTop: 'var(--space-md)'
              }}>
                {layerServices.map(service => (
                  <div 
                    key={service.name}
                    style={{
                      padding: 'var(--space-md)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                      <span style={{ fontSize: '1.25rem' }}>{service.icon}</span>
                      <span style={{ fontWeight: 600 }}>{service.name}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Port: {service.port}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, marginTop: '4px' }}>
                      {service.technology}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Technology Stack Component
function TechnologyStack() {
  const technologies = [
    { name: 'React', category: 'Frontend', icon: '⚛️' },
    { name: 'Node.js', category: 'Backend', icon: '🟢' },
    { name: 'Express.js', category: 'Backend', icon: '🚂' },
    { name: 'PostgreSQL', category: 'Database', icon: '🐘' },
    { name: 'MongoDB', category: 'Database', icon: '🍃' },
    { name: 'Apache Kafka', category: 'Messaging', icon: '📨' },
    { name: 'Traefik', category: 'Gateway', icon: '🚀' },
    { name: 'Elasticsearch', category: 'Search', icon: '🔍' },
    { name: 'Prometheus', category: 'Monitoring', icon: '🔥' },
    { name: 'Grafana', category: 'Visualization', icon: '📊' },
    { name: 'Jaeger', category: 'Tracing', icon: '🔬' },
    { name: 'Docker/Podman', category: 'Container', icon: '🐳' }
  ]

  return (
    <div className="card" style={{ padding: 'var(--space-xl)' }}>
      <h3 style={{ marginBottom: 'var(--space-lg)' }}>Technology Stack</h3>
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 'var(--space-sm)' 
      }}>
        {technologies.map((tech, i) => (
          <motion.div
            key={tech.name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              padding: 'var(--space-sm) var(--space-md)',
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)',
              fontSize: '0.875rem'
            }}
          >
            <span>{tech.icon}</span>
            <span>{tech.name}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function ArchitecturePage() {
  const [expandedLayer, setExpandedLayer] = useState(null)

  return (
    <div style={{ maxWidth: 1200 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ marginBottom: 'var(--space-sm)' }}>Architecture</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2xl)', fontSize: '1.125rem' }}>
          ECCS follows a modern microservices architecture with clear separation of concerns across multiple layers.
        </p>
      </motion.div>

      {/* Interactive Architecture Diagram */}
      <AnimatedArchitecture />

      {/* Architecture Principles */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ marginBottom: 'var(--space-2xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Design Principles</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--space-md)'
        }}>
          {[
            { icon: FiLayers, title: 'Layered Architecture', desc: 'Clear separation between frontend, API, business logic, and data layers' },
            { icon: FiBox, title: 'Containerization', desc: 'All services run in isolated containers for consistency and portability' },
            { icon: FiActivity, title: 'Event-Driven', desc: 'Async communication via Kafka for scalability and reliability' },
            { icon: FiShield, title: 'Security First', desc: 'JWT auth, rate limiting, and TLS encryption at every layer' }
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="card"
              style={{ padding: 'var(--space-lg)' }}
            >
              <item.icon size={24} style={{ color: 'var(--color-primary-light)', marginBottom: 'var(--space-sm)' }} />
              <h4 style={{ marginBottom: 'var(--space-xs)' }}>{item.title}</h4>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Layer Details */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{ marginBottom: 'var(--space-2xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Architecture Layers</h2>
        {architectureLayers.map(layer => (
          <LayerCard
            key={layer.name}
            layer={layer}
            isExpanded={expandedLayer === layer.name}
            onToggle={() => setExpandedLayer(expandedLayer === layer.name ? null : layer.name)}
          />
        ))}
      </motion.section>

      {/* Technology Stack */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ marginBottom: 'var(--space-2xl)' }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Technology Stack</h2>
        <TechnologyStack />
      </motion.section>

      {/* Container Communication */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Container Communication</h2>
        <div className="card" style={{ padding: 'var(--space-xl)' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--space-xl)'
          }}>
            <div>
              <h4 style={{ color: 'var(--color-success)', marginBottom: 'var(--space-sm)' }}>
                🔄 Synchronous (HTTP/REST)
              </h4>
              <ul style={{ color: 'var(--color-text-secondary)', paddingLeft: 'var(--space-lg)', lineHeight: 1.8 }}>
                <li>Frontend → Traefik → Auth Service</li>
                <li>Frontend → Traefik → Email Service</li>
                <li>Auth Service → PostgreSQL</li>
                <li>Email Service → PostgreSQL</li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: 'var(--color-warning)', marginBottom: 'var(--space-sm)' }}>
                📨 Asynchronous (Kafka)
              </h4>
              <ul style={{ color: 'var(--color-text-secondary)', paddingLeft: 'var(--space-lg)', lineHeight: 1.8 }}>
                <li>Email Service → Kafka → Notification Service</li>
                <li>Notification Service → Kafka (retry)</li>
                <li>Notification Service → Kafka (DLQ)</li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: 'var(--color-info)', marginBottom: 'var(--space-sm)' }}>
                📊 Observability
              </h4>
              <ul style={{ color: 'var(--color-text-secondary)', paddingLeft: 'var(--space-lg)', lineHeight: 1.8 }}>
                <li>All Services → Logstash → Elasticsearch</li>
                <li>Prometheus scrapes /metrics endpoints</li>
                <li>Jaeger collects distributed traces</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  )
}

export default ArchitecturePage
